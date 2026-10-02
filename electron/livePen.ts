import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import { USER_DATA_PATH } from "./appPaths";
import { selectedSource } from "./ipc/state";
import {
	DEFAULT_LIVE_PEN_SETTINGS,
	LIVE_PEN_TOOL_SHORTCUTS,
	type LivePenSettings,
	mergeLivePenSettings,
	resolveToolShortcut,
} from "./livePenSettings";
import { getHudOverlayWindow, reassertHudOverlayMousePassthrough } from "./windows";

// Live pen: a transparent, always-on-top canvas over the recorded display. It is NOT
// capture-protected, so whatever is drawn ends up in the recording. Its controls live in
// the capture-protected HUD, which is kept above the canvas. With "showToolbarInRecording"
// the overlay also draws its own toolbar, so viewers see the tools being picked.

export type { LivePenSettings, LivePenTool } from "./livePenSettings";

export interface LivePenState {
	active: boolean;
	settings: LivePenSettings;
	shortcut: string;
}

export const LIVE_PEN_SHORTCUT = "CommandOrControl+Shift+D";

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(electronDir, "..", "dist");
const LIVE_PEN_SETTINGS_FILE = path.join(USER_DATA_PATH, "live-pen-settings.json");

let livePenWindow: BrowserWindow | null = null;
let recordingActive = false;
let settings: LivePenSettings = loadSettings();

function loadSettings(): LivePenSettings {
	try {
		const raw = JSON.parse(fs.readFileSync(LIVE_PEN_SETTINGS_FILE, "utf8"));
		return mergeLivePenSettings(DEFAULT_LIVE_PEN_SETTINGS, raw);
	} catch {
		return { ...DEFAULT_LIVE_PEN_SETTINGS };
	}
}

function saveSettings() {
	fs.promises
		.writeFile(LIVE_PEN_SETTINGS_FILE, JSON.stringify(settings, null, "	"), "utf8")
		.catch((error) => console.warn("[live-pen] Failed to save settings:", error));
}

function getState(): LivePenState {
	return { active: Boolean(livePenWindow), settings, shortcut: LIVE_PEN_SHORTCUT };
}

function broadcastState() {
	const state = getState();
	for (const win of BrowserWindow.getAllWindows()) {
		if (!win.isDestroyed()) win.webContents.send("live-pen-state", state);
	}
}

/** The display being recorded; falls back to the one under the cursor. */
function getTargetDisplay() {
	const displays = screen.getAllDisplays();
	const displayId = Number(selectedSource?.display_id);
	return (
		(Number.isFinite(displayId) && displays.find((display) => display.id === displayId)) ||
		screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
	);
}

function keepHudAbovePen() {
	const hud = getHudOverlayWindow();
	if (hud && !hud.isDestroyed()) hud.moveTop();
	reassertHudOverlayMousePassthrough();
}

function createLivePenWindow() {
	const { bounds } = getTargetDisplay();
	const win = new BrowserWindow({
		...bounds,
		frame: false,
		transparent: true,
		backgroundColor: "#00000000",
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,
		skipTaskbar: true,
		hasShadow: false,
		focusable: true,
		enableLargerThanScreen: true,
		show: false,
		webPreferences: {
			preload: path.join(electronDir, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});
	win.setAlwaysOnTop(true, "screen-saver");
	win.setBounds(bounds);
	win.once("ready-to-show", () => {
		if (win.isDestroyed()) return;
		win.show();
		win.focus();
		win.webContents.send("live-pen-settings", settings);
		keepHudAbovePen();
	});
	win.on("closed", () => {
		if (livePenWindow === win) livePenWindow = null;
		broadcastState();
		reassertHudOverlayMousePassthrough();
	});
	if (VITE_DEV_SERVER_URL) {
		void win.loadURL(`${VITE_DEV_SERVER_URL}?windowType=live-pen`);
	} else {
		void win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "live-pen" },
		});
	}
	return win;
}

export function setLivePenActive(active: boolean) {
	if (active && !livePenWindow) {
		livePenWindow = createLivePenWindow();
	} else if (!active && livePenWindow) {
		// Closing the window also wipes the drawing, like ZoomIt's Esc.
		const win = livePenWindow;
		livePenWindow = null;
		if (!win.isDestroyed()) win.close();
	}
	broadcastState();
	return getState();
}

function updateSettings(update: unknown) {
	settings = mergeLivePenSettings(settings, update);
	saveSettings();
	livePenWindow?.webContents.send("live-pen-settings", settings);
	broadcastState();
	return getState();
}

function registerShortcut(accelerator: string, handler: () => void) {
	if (globalShortcut.isRegistered(accelerator)) return;
	if (!globalShortcut.register(accelerator, handler)) {
		console.warn(`[live-pen] Could not register ${accelerator}; another app may own it.`);
	}
}

/** Global hotkeys only exist while recording so they never steal the combos otherwise. */
export function setLivePenRecordingActive(recording: boolean) {
	recordingActive = recording;
	if (recording) {
		registerShortcut(LIVE_PEN_SHORTCUT, () => {
			if (recordingActive) setLivePenActive(!livePenWindow);
		});
		for (const { accelerator, tool } of LIVE_PEN_TOOL_SHORTCUTS) {
			registerShortcut(accelerator, () => {
				if (!recordingActive) return;
				const next = resolveToolShortcut(Boolean(livePenWindow), settings.tool, tool);
				if (next.tool !== settings.tool) updateSettings({ tool: next.tool });
				setLivePenActive(next.active);
			});
		}
	} else {
		globalShortcut.unregister(LIVE_PEN_SHORTCUT);
		for (const { accelerator } of LIVE_PEN_TOOL_SHORTCUTS)
			globalShortcut.unregister(accelerator);
		setLivePenActive(false);
	}
}

export function registerLivePenHandlers() {
	ipcMain.handle("live-pen:get-state", () => getState());
	ipcMain.handle("live-pen:set-active", (_, active: boolean) =>
		setLivePenActive(Boolean(active)),
	);
	ipcMain.handle("live-pen:update-settings", (_, update: unknown) => updateSettings(update));
	ipcMain.handle("live-pen:command", (_, command: "undo" | "clear") => {
		if (command === "undo" || command === "clear") {
			livePenWindow?.webContents.send("live-pen-command", command);
		}
	});
}

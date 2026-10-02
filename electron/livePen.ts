import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import { selectedSource } from "./ipc/state";
import { getHudOverlayWindow, reassertHudOverlayMousePassthrough } from "./windows";

// Live pen: a transparent, always-on-top canvas over the recorded display. It is NOT
// capture-protected, so whatever is drawn ends up in the recording. Its controls live in
// the capture-protected HUD, which is kept above the canvas.

export type LivePenTool = "pen" | "highlighter" | "arrow" | "rect";

export interface LivePenSettings {
	tool: LivePenTool;
	color: string;
	width: number;
}

export interface LivePenState {
	active: boolean;
	settings: LivePenSettings;
	shortcut: string;
}

export const LIVE_PEN_SHORTCUT = "CommandOrControl+Shift+D";

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(electronDir, "..", "dist");

let livePenWindow: BrowserWindow | null = null;
let recordingActive = false;
let settings: LivePenSettings = { tool: "pen", color: "#ef4444", width: 6 };

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

function updateSettings(update: Partial<LivePenSettings>) {
	const tools: LivePenTool[] = ["pen", "highlighter", "arrow", "rect"];
	settings = {
		tool: update.tool && tools.includes(update.tool) ? update.tool : settings.tool,
		color:
			typeof update.color === "string" && /^#[0-9a-f]{6}$/i.test(update.color)
				? update.color
				: settings.color,
		width:
			typeof update.width === "number" && Number.isFinite(update.width)
				? Math.min(40, Math.max(1, update.width))
				: settings.width,
	};
	livePenWindow?.webContents.send("live-pen-settings", settings);
	broadcastState();
	return getState();
}

/** The global hotkey only exists while recording so it never steals the combo otherwise. */
export function setLivePenRecordingActive(recording: boolean) {
	recordingActive = recording;
	if (recording) {
		if (!globalShortcut.isRegistered(LIVE_PEN_SHORTCUT)) {
			globalShortcut.register(LIVE_PEN_SHORTCUT, () => {
				if (recordingActive) setLivePenActive(!livePenWindow);
			});
		}
	} else {
		globalShortcut.unregister(LIVE_PEN_SHORTCUT);
		setLivePenActive(false);
	}
}

export function registerLivePenHandlers() {
	ipcMain.handle("live-pen:get-state", () => getState());
	ipcMain.handle("live-pen:set-active", (_, active: boolean) =>
		setLivePenActive(Boolean(active)),
	);
	ipcMain.handle("live-pen:update-settings", (_, update: Partial<LivePenSettings>) =>
		updateSettings(update ?? {}),
	);
	ipcMain.handle("live-pen:command", (_, command: "undo" | "clear") => {
		if (command === "undo" || command === "clear") {
			livePenWindow?.webContents.send("live-pen-command", command);
		}
	});
}

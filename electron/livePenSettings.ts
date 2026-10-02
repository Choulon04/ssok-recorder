export type LivePenTool = "pen" | "highlighter" | "arrow" | "rect";

export interface LivePenSettings {
	tool: LivePenTool;
	color: string;
	width: number;
	/** Show the pen toolbar on the overlay itself, so it is part of the recording. */
	showToolbarInRecording: boolean;
}

export const DEFAULT_LIVE_PEN_SETTINGS: LivePenSettings = {
	tool: "pen",
	color: "#ef4444",
	width: 6,
	showToolbarInRecording: false,
};

const TOOLS: readonly LivePenTool[] = ["pen", "highlighter", "arrow", "rect"];

/**
 * Recording-time global hotkeys that open the pen straight into a tool. Modifier combos on
 * purpose: bare letters would swallow typing in the app being recorded.
 */
export const LIVE_PEN_TOOL_SHORTCUTS: ReadonlyArray<{ accelerator: string; tool: LivePenTool }> = [
	{ accelerator: "CommandOrControl+Alt+P", tool: "pen" },
	{ accelerator: "CommandOrControl+Alt+H", tool: "highlighter" },
	{ accelerator: "CommandOrControl+Alt+A", tool: "arrow" },
	{ accelerator: "CommandOrControl+Alt+R", tool: "rect" },
];

/** Pressing a tool hotkey: open the pen in that tool, switch tools, or close if it is the same. */
export function resolveToolShortcut(
	active: boolean,
	currentTool: LivePenTool,
	pressedTool: LivePenTool,
): { active: boolean; tool: LivePenTool } {
	if (active && currentTool === pressedTool) return { active: false, tool: currentTool };
	return { active: true, tool: pressedTool };
}

/** Applies an untrusted (IPC or on-disk) update on top of the current settings. */
export function mergeLivePenSettings(current: LivePenSettings, update: unknown): LivePenSettings {
	const next = (update && typeof update === "object" ? update : {}) as Record<string, unknown>;
	return {
		tool: TOOLS.includes(next.tool as LivePenTool) ? (next.tool as LivePenTool) : current.tool,
		color:
			typeof next.color === "string" && /^#[0-9a-f]{6}$/i.test(next.color)
				? next.color
				: current.color,
		width:
			typeof next.width === "number" && Number.isFinite(next.width)
				? Math.min(40, Math.max(1, next.width))
				: current.width,
		showToolbarInRecording:
			typeof next.showToolbarInRecording === "boolean"
				? next.showToolbarInRecording
				: current.showToolbarInRecording,
	};
}

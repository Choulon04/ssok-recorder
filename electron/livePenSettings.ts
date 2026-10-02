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

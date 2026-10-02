/** Gap left between consecutive narration lines placed back to back. */
export const NARRATION_LINE_GAP_MS = 400;

export type NarrationPlacementMode = "sequential" | "chapters";

export interface NarrationLineTiming {
	startMs: number;
	endMs: number;
	/** True when the line had to be cut at the end of the video. */
	truncated: boolean;
}

/** Splits a script into narration lines: one per paragraph (blank-line separated). */
export function splitNarrationScript(script: string): string[] {
	return script
		.replace(/\r\n/g, "\n")
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
		.filter(Boolean);
}

/**
 * Lays out narration lines on the timeline.
 * - "sequential": back to back from `startMs`.
 * - "chapters": line i starts at chapter i (or right after line i-1 if that runs long);
 *   lines beyond the last chapter continue sequentially.
 */
export function placeNarrationLines({
	durationsMs,
	mode,
	startMs,
	chapterStartsMs,
	totalMs,
}: {
	durationsMs: readonly number[];
	mode: NarrationPlacementMode;
	startMs: number;
	chapterStartsMs: readonly number[];
	totalMs: number;
}): Array<NarrationLineTiming | null> {
	const chapters = [...chapterStartsMs].sort((a, b) => a - b);
	let cursor = Math.max(0, startMs);
	return durationsMs.map((durationMs, index) => {
		const anchor = mode === "chapters" && index < chapters.length ? chapters[index] : null;
		const start = Math.round(anchor === null ? cursor : Math.max(anchor, cursor));
		if (start >= totalMs || durationMs <= 0) return null;
		const end = Math.min(start + Math.round(durationMs), totalMs);
		cursor = end + NARRATION_LINE_GAP_MS;
		return { startMs: start, endMs: end, truncated: start + durationMs > totalMs };
	});
}

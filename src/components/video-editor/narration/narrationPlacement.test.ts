import { describe, expect, it } from "vitest";
import {
	NARRATION_LINE_GAP_MS,
	placeNarrationLines,
	splitNarrationScript,
} from "./narrationPlacement";

describe("splitNarrationScript", () => {
	it("splits paragraphs and joins wrapped lines", () => {
		expect(
			splitNarrationScript(
				"안녕하세요.\n오늘은 녹화를 해봅니다.\n\n\n  먼저 버튼을 누르세요.  \r\n\r\n",
			),
		).toEqual(["안녕하세요. 오늘은 녹화를 해봅니다.", "먼저 버튼을 누르세요."]);
	});
});

describe("placeNarrationLines", () => {
	it("places lines back to back from the playhead", () => {
		const lines = placeNarrationLines({
			durationsMs: [2000, 3000],
			mode: "sequential",
			startMs: 1000,
			chapterStartsMs: [],
			totalMs: 60_000,
		});
		expect(lines).toEqual([
			{ startMs: 1000, endMs: 3000, truncated: false },
			{
				startMs: 3000 + NARRATION_LINE_GAP_MS,
				endMs: 6000 + NARRATION_LINE_GAP_MS,
				truncated: false,
			},
		]);
	});

	it("anchors lines to chapters, pushing past a long previous line", () => {
		const lines = placeNarrationLines({
			durationsMs: [5000, 2000, 1000],
			mode: "chapters",
			startMs: 0,
			chapterStartsMs: [10_000, 2000],
			totalMs: 60_000,
		});
		expect(lines.map((line) => line?.startMs)).toEqual([
			2000,
			10_000,
			12_000 + NARRATION_LINE_GAP_MS,
		]);
	});

	it("truncates at the video end and drops lines that start after it", () => {
		const lines = placeNarrationLines({
			durationsMs: [4000, 1000],
			mode: "sequential",
			startMs: 7000,
			chapterStartsMs: [],
			totalMs: 10_000,
		});
		expect(lines).toEqual([{ startMs: 7000, endMs: 10_000, truncated: true }, null]);
	});
});

import { describe, expect, it } from "vitest";
import {
	buildYouTubeChapterList,
	CHAPTER_CARD_DURATION_MS,
	createChapterAnnotation,
	getChapterNumberAt,
	getChapters,
	pickChapterTrackIndex,
} from "./chapterMarkers";
import type { AnnotationRegion } from "./types";

function chapter(id: string, startMs: number, title: string, trackIndex = 0) {
	return createChapterAnnotation({
		id,
		startMs,
		totalMs: 600_000,
		title,
		zIndex: 1,
		regions: [],
	}) as AnnotationRegion & { trackIndex: number };
}

describe("chapter markers", () => {
	it("creates a screen-fixed chapter card clamped to the video", () => {
		const region = createChapterAnnotation({
			id: "a",
			startMs: 9_000,
			totalMs: 10_000,
			title: "1단계",
			zIndex: 3,
			regions: [],
		});
		expect(region).toMatchObject({
			role: "chapter",
			type: "text",
			startMs: 9_000,
			endMs: 10_000,
			textContent: "1단계",
		});
		expect(chapter("b", 0, "x").endMs).toBe(CHAPTER_CARD_DURATION_MS);
	});

	it("keeps chapters on one free track and avoids overlapping annotations", () => {
		const first = { ...chapter("c1", 0, "1단계"), trackIndex: 2 };
		const note: AnnotationRegion = {
			...chapter("n", 20_000, "note"),
			role: undefined,
			trackIndex: 2,
		};
		expect(pickChapterTrackIndex([first], 10_000, 13_000)).toBe(2);
		expect(pickChapterTrackIndex([first, note], 20_500, 23_500)).toBe(3);
		expect(pickChapterTrackIndex([], 0, 3_000)).toBe(0);
	});

	it("numbers and sorts chapters by start time", () => {
		const regions = [chapter("b", 30_000, "두번째"), chapter("a", 5_000, "첫번째")];
		expect(getChapters(regions).map((entry) => entry.title)).toEqual(["첫번째", "두번째"]);
		expect(getChapterNumberAt(regions, 40_000)).toBe(3);
		expect(getChapterNumberAt(regions, 10_000)).toBe(2);
	});

	it("builds a YouTube chapter list starting at 0:00", () => {
		const list = buildYouTubeChapterList(
			[
				{ id: "1", startMs: 15_000, title: "1단계 녹화 시작" },
				{ id: "2", startMs: 75_500, title: "2단계 편집" },
			],
			200_000,
			"인트로",
		);
		expect(list.text).toBe("0:00 인트로\n0:15 1단계 녹화 시작\n1:15 2단계 편집");
		expect(list.warnings).toEqual([]);
	});

	it("moves a near-zero first chapter to 0:00 and flags lists YouTube would ignore", () => {
		const list = buildYouTubeChapterList(
			[
				{ id: "1", startMs: 400, title: "시작" },
				{ id: "2", startMs: 5_000, title: "짧음" },
			],
			4_000_000,
		);
		expect(list.text).toBe("0:00:00 시작\n0:00:05 짧음");
		expect(list.warnings).toEqual(["too-few", "too-short"]);
	});
});

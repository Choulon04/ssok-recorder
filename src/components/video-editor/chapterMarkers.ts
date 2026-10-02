import { type AnnotationRegion, DEFAULT_ANNOTATION_STYLE } from "./types";

/** How long the on-screen step card stays visible after a chapter starts. */
export const CHAPTER_CARD_DURATION_MS = 3000;

/** YouTube only turns a description timestamp list into chapters when these rules hold. */
export const YOUTUBE_MIN_CHAPTERS = 3;
export const YOUTUBE_MIN_CHAPTER_LENGTH_MS = 10_000;

export interface ChapterEntry {
	id: string;
	startMs: number;
	title: string;
}

export function isChapterAnnotation(region: AnnotationRegion) {
	return region.role === "chapter";
}

export function getChapterTitle(region: AnnotationRegion) {
	return (region.textContent ?? region.content ?? "").trim();
}

export function getChapters(regions: readonly AnnotationRegion[]): ChapterEntry[] {
	return regions
		.filter(isChapterAnnotation)
		.map((region) => ({
			id: region.id,
			startMs: region.startMs,
			title: getChapterTitle(region),
		}))
		.sort((a, b) => a.startMs - b.startMs);
}

/** 1-based step number a new chapter at `startMs` would get. */
export function getChapterNumberAt(regions: readonly AnnotationRegion[], startMs: number) {
	return getChapters(regions).filter((chapter) => chapter.startMs <= startMs).length + 1;
}

function overlaps(region: AnnotationRegion, startMs: number, endMs: number) {
	return region.startMs < endMs && startMs < region.endMs;
}

/**
 * Keeps chapters together on one annotation track; falls back to a fresh track when that
 * track (or no chapter track yet) would overlap the new card.
 */
export function pickChapterTrackIndex(
	regions: readonly AnnotationRegion[],
	startMs: number,
	endMs: number,
) {
	const isFree = (trackIndex: number) =>
		!regions.some(
			(region) => (region.trackIndex ?? 0) === trackIndex && overlaps(region, startMs, endMs),
		);
	const chapterTracks = [
		...new Set(regions.filter(isChapterAnnotation).map((region) => region.trackIndex ?? 0)),
	];
	const freeChapterTrack = chapterTracks.find(isFree);
	if (freeChapterTrack !== undefined) return freeChapterTrack;
	if (regions.length === 0) return 0;
	return Math.max(...regions.map((region) => region.trackIndex ?? 0)) + 1;
}

export function createChapterAnnotation({
	id,
	startMs,
	totalMs,
	title,
	zIndex,
	regions,
}: {
	id: string;
	startMs: number;
	totalMs: number;
	title: string;
	zIndex: number;
	regions: readonly AnnotationRegion[];
}): AnnotationRegion | null {
	const start = Math.max(0, Math.round(Math.min(startMs, totalMs - 1)));
	const end = Math.round(Math.min(start + CHAPTER_CARD_DURATION_MS, totalMs));
	if (end <= start) return null;
	return {
		id,
		role: "chapter",
		startMs: start,
		endMs: end,
		type: "text",
		content: title,
		textContent: title,
		position: { x: 3, y: 5 },
		size: { width: 40, height: 12 },
		style: {
			...DEFAULT_ANNOTATION_STYLE,
			color: "#ffffff",
			backgroundColor: "rgba(15, 23, 42, 0.82)",
			fontSize: 44,
			fontWeight: "bold",
			textAlign: "left",
			borderRadius: 16,
		},
		zIndex,
		trackIndex: pickChapterTrackIndex(regions, start, end),
	};
}

function formatYouTubeTimestamp(ms: number, includeHours: boolean) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const ss = String(seconds).padStart(2, "0");
	if (includeHours) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
	return `${minutes}:${ss}`;
}

export interface YouTubeChapterList {
	text: string;
	/** Reasons YouTube would ignore the list; empty when it is valid. */
	warnings: Array<"too-few" | "too-short">;
}

/**
 * Builds a YouTube description chapter list. YouTube requires the first timestamp at 0:00,
 * so an "Intro" entry is prepended when the first chapter starts later.
 */
export function buildYouTubeChapterList(
	chapters: readonly ChapterEntry[],
	totalMs: number,
	introTitle = "Intro",
): YouTubeChapterList {
	const sorted = [...chapters].sort((a, b) => a.startMs - b.startMs);
	const entries =
		sorted.length > 0 && Math.floor(sorted[0].startMs / 1000) > 0
			? [{ id: "intro", startMs: 0, title: introTitle }, ...sorted]
			: sorted.map((chapter, index) => (index === 0 ? { ...chapter, startMs: 0 } : chapter));
	const includeHours = totalMs >= 3_600_000;
	const text = entries
		.map((entry, index) => {
			const title = entry.title || `${index + 1}`;
			return `${formatYouTubeTimestamp(entry.startMs, includeHours)} ${title}`;
		})
		.join("\n");

	const warnings: YouTubeChapterList["warnings"] = [];
	if (entries.length < YOUTUBE_MIN_CHAPTERS) warnings.push("too-few");
	const tooShort = entries.some((entry, index) => {
		const nextStart = entries[index + 1]?.startMs ?? totalMs;
		return nextStart - entry.startMs < YOUTUBE_MIN_CHAPTER_LENGTH_MS;
	});
	if (tooShort) warnings.push("too-short");
	return { text, warnings };
}

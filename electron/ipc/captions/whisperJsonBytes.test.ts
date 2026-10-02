import { describe, expect, it } from "vitest";
import { parseWhisperJsonCues } from "./parser";
import { completeUtf8PrefixLength, decodeWhisperJsonOutput } from "./whisperJsonBytes";

/** Builds whisper-style JSON bytes where each token carries an arbitrary byte slice. */
function whisperJsonBytes(segmentText: string, tokenByteSlices: Buffer[]) {
	const tokens = tokenByteSlices.map((bytes, index) => ({
		text: bytes.toString("latin1"),
		offsets: { from: index * 100, to: index * 100 + 100 },
	}));
	const json = JSON.stringify({
		transcription: [
			{
				offsets: { from: 0, to: tokenByteSlices.length * 100 },
				text: Buffer.from(segmentText, "utf8").toString("latin1"),
				tokens,
			},
		],
	});
	return Buffer.from(json, "latin1");
}

describe("decodeWhisperJsonOutput", () => {
	it("re-joins Korean characters split across tokens", () => {
		const text = " 쏙레코더로 화면을";
		const bytes = Buffer.from(text, "utf8");
		// Split mid-character: " 쏙" + half of "레" ...
		const slices = [bytes.subarray(0, 5), bytes.subarray(5, 9), bytes.subarray(9)];

		const cues = parseWhisperJsonCues(decodeWhisperJsonOutput(whisperJsonBytes(text, slices)));

		expect(cues).toHaveLength(1);
		expect(cues[0].text).toBe("쏙레코더로 화면을");
		expect(cues[0].text).not.toContain("�");
		expect(cues[0].words?.map((word) => word.text)).toEqual(["쏙레코더로", "화면을"]);
	});

	it("leaves ASCII output unchanged", () => {
		const text = " Hello world";
		const bytes = Buffer.from(text, "utf8");
		const cues = parseWhisperJsonCues(
			decodeWhisperJsonOutput(
				whisperJsonBytes(text, [bytes.subarray(0, 6), bytes.subarray(6)]),
			),
		);
		expect(cues[0].text).toBe("Hello world");
	});

	it("finds the last complete UTF-8 boundary", () => {
		const korean = Buffer.from("가나", "utf8"); // 6 bytes
		expect(completeUtf8PrefixLength(korean)).toBe(6);
		expect(completeUtf8PrefixLength(korean.subarray(0, 5))).toBe(3);
		expect(completeUtf8PrefixLength(korean.subarray(0, 4))).toBe(3);
		expect(completeUtf8PrefixLength(Buffer.from("ab", "utf8"))).toBe(2);
	});
});

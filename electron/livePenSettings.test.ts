import { describe, expect, it } from "vitest";
import { DEFAULT_LIVE_PEN_SETTINGS, mergeLivePenSettings } from "./livePenSettings";

describe("mergeLivePenSettings", () => {
	it("applies valid fields and keeps the rest", () => {
		expect(
			mergeLivePenSettings(DEFAULT_LIVE_PEN_SETTINGS, {
				tool: "highlighter",
				showToolbarInRecording: true,
			}),
		).toEqual({
			...DEFAULT_LIVE_PEN_SETTINGS,
			tool: "highlighter",
			showToolbarInRecording: true,
		});
	});

	it("ignores invalid values from IPC or a corrupt settings file", () => {
		expect(
			mergeLivePenSettings(DEFAULT_LIVE_PEN_SETTINGS, {
				tool: "laser",
				color: "red; drop table",
				width: Number.NaN,
				showToolbarInRecording: "yes",
			}),
		).toEqual(DEFAULT_LIVE_PEN_SETTINGS);
		expect(mergeLivePenSettings(DEFAULT_LIVE_PEN_SETTINGS, null)).toEqual(
			DEFAULT_LIVE_PEN_SETTINGS,
		);
	});

	it("clamps the stroke width", () => {
		expect(mergeLivePenSettings(DEFAULT_LIVE_PEN_SETTINGS, { width: 500 }).width).toBe(40);
		expect(mergeLivePenSettings(DEFAULT_LIVE_PEN_SETTINGS, { width: 0 }).width).toBe(1);
	});
});

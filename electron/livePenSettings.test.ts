import { describe, expect, it } from "vitest";
import {
	DEFAULT_LIVE_PEN_SETTINGS,
	LIVE_PEN_TOOL_SHORTCUTS,
	mergeLivePenSettings,
	resolveToolShortcut,
} from "./livePenSettings";

describe("live pen tool shortcuts", () => {
	it("opens, switches tools, and closes on the same key", () => {
		expect(resolveToolShortcut(false, "pen", "highlighter")).toEqual({
			active: true,
			tool: "highlighter",
		});
		expect(resolveToolShortcut(true, "pen", "arrow")).toEqual({ active: true, tool: "arrow" });
		expect(resolveToolShortcut(true, "rect", "rect")).toEqual({ active: false, tool: "rect" });
	});

	it("uses modifier combos only, one per tool", () => {
		expect(LIVE_PEN_TOOL_SHORTCUTS.map((entry) => entry.tool)).toEqual([
			"pen",
			"highlighter",
			"arrow",
			"rect",
		]);
		for (const { accelerator } of LIVE_PEN_TOOL_SHORTCUTS) {
			expect(accelerator).toMatch(/^CommandOrControl\+Alt\+[A-Z]$/);
		}
	});
});

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

import { describe, expect, it } from "vitest";
import { cursorSetAssets, getCursorStyleSizeMultiplier } from "./uploadedCursorAssets";

describe("cursor set assets", () => {
	it("renders every image cursor style with SsokRecorder's own set", () => {
		// Projects saved with the former OS-styled sets keep opening, on the original artwork.
		expect(cursorSetAssets.macos).toBe(cursorSetAssets.tahoe);
		expect(cursorSetAssets.windows11).toBe(cursorSetAssets.tahoe);
		for (const entry of Object.values(cursorSetAssets.tahoe)) {
			expect(entry.url).toMatch(/cursors\/ssok\//);
		}
	});

	it("keeps the hotspots of the slots the artwork was drawn for", () => {
		expect(cursorSetAssets.tahoe.arrow.fallbackAnchor).toEqual({ x: 0.14, y: 0.06 });
		expect(cursorSetAssets.tahoe.pointer.fallbackAnchor).toEqual({ x: 0.4, y: 0.1 });
		expect(cursorSetAssets.tahoe["not-allowed"].fallbackAnchor).toEqual({ x: 0.23, y: 0 });
	});

	it("uses one size multiplier for all image styles", () => {
		for (const style of ["macos", "tahoe", "tahoe-inverted", "windows11", "dot"] as const) {
			expect(getCursorStyleSizeMultiplier(style)).toBe(1);
		}
	});
});

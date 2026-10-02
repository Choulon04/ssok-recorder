import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BUILT_IN_WALLPAPERS,
	DEFAULT_WALLPAPER_PATH,
	DEFAULT_WALLPAPER_RELATIVE_PATH,
	getAvailableWallpapers,
	resolveAvailableWallpaperPath,
} from "./wallpapers";

describe("wallpapers", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("keeps the curated wallpaper list and default path aligned", () => {
		expect(DEFAULT_WALLPAPER_PATH).toBe("/wallpapers/ssok-aurora.jpg");
		expect(DEFAULT_WALLPAPER_RELATIVE_PATH).toBe("wallpapers/ssok-aurora.jpg");
		expect(BUILT_IN_WALLPAPERS.at(0)?.publicPath).toBe(DEFAULT_WALLPAPER_PATH);
		expect(BUILT_IN_WALLPAPERS.at(1)?.publicPath).toBe("/wallpapers/ssok-ocean.jpg");
		expect(BUILT_IN_WALLPAPERS).toHaveLength(12);
		// Only original SsokRecorder artwork is bundled.
		for (const wallpaper of BUILT_IN_WALLPAPERS) {
			expect(wallpaper.relativePath).toMatch(/^wallpapers\/ssok-[a-z]+\.jpg$/);
		}
	});

	it("preserves the curated order when asset discovery returns extra files", async () => {
		vi.stubGlobal("window", {
			electronAPI: {
				listAssetDirectory: vi.fn(async () => ({
					success: true,
					files: [
						"unrelated.jpg",
						"ssok-lavender.jpg",
						"ssok-ocean.jpg",
						"ssok-sunset.jpg",
						"notes.txt",
						"ssok-graphite.jpg",
						"ssok-grape.jpg",
					],
				})),
			},
		});

		await expect(getAvailableWallpapers()).resolves.toEqual([
			BUILT_IN_WALLPAPERS[1],
			BUILT_IN_WALLPAPERS[3],
			BUILT_IN_WALLPAPERS[4],
			BUILT_IN_WALLPAPERS[7],
			BUILT_IN_WALLPAPERS[11],
		]);
	});

	it("falls back to the default wallpaper when a bundled wallpaper is missing", async () => {
		vi.stubGlobal("window", {
			electronAPI: {
				listAssetDirectory: vi.fn().mockResolvedValue({
					success: true,
					files: ["wallpaper2.jpg"],
				}),
			},
		});

		await expect(resolveAvailableWallpaperPath("/wallpapers/midnight-8.jpg")).resolves.toBe(
			DEFAULT_WALLPAPER_PATH,
		);
		await expect(resolveAvailableWallpaperPath("/wallpapers/wallpaper2.jpg")).resolves.toBe(
			"/wallpapers/wallpaper2.jpg",
		);
	});

	it("strips query strings and fragments before checking bundled wallpaper files", async () => {
		vi.stubGlobal("window", {
			electronAPI: {
				listAssetDirectory: vi.fn().mockResolvedValue({
					success: true,
					files: ["wispysky.mp4"],
				}),
			},
		});

		await expect(resolveAvailableWallpaperPath("/wallpapers/wispysky.mp4#t=0.1")).resolves.toBe(
			"/wallpapers/wispysky.mp4#t=0.1",
		);
	});

	it("preserves non-bundled wallpaper values", async () => {
		await expect(resolveAvailableWallpaperPath("#123456")).resolves.toBe("#123456");
		await expect(resolveAvailableWallpaperPath("data:image/png;base64,abc")).resolves.toBe(
			"data:image/png;base64,abc",
		);
	});
});

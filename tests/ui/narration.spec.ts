import { expect, test } from "@playwright/test";
import { installDesktopBridge, installDesktopBridgeOverrides } from "./bridge";

test("narration dialog synthesizes each paragraph onto an audio track", async ({ page }) => {
	test.setTimeout(120000);
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await installDesktopBridge(page);
	await installDesktopBridgeOverrides(page, () => {
		const calls: string[] = [];
		Object.assign(window, { __narrationCalls: calls });
		window.electronAPI.getNarrationSettings = async () => ({
			success: true,
			settings: { voiceId: "voice-1", model: "s2.1-pro", speed: 1.1, hasApiKey: true },
		});
		window.electronAPI.saveNarrationSettings = async (update) => ({
			success: true,
			settings: {
				voiceId: update.voiceId ?? "voice-1",
				model: "s2.1-pro",
				speed: update.speed ?? 1.1,
				hasApiKey: true,
			},
		});
		window.electronAPI.synthesizeNarration = async (text: string) => {
			calls.push(text);
			return {
				success: true,
				path: `${location.origin}/tests/ui/fixtures/preview.mp4`,
				durationMs: 1500,
				cached: false,
			};
		};
	});
	await page.goto("/?windowType=editor");
	await expect(page.getByRole("navigation", { name: "Editor tools" })).toBeVisible({
		timeout: 20000,
	});

	await page.getByRole("button", { name: /Add layer/i }).click();
	await page.getByRole("menuitem", { name: "Narration (TTS)" }).click();
	await page
		.getByLabel("Script")
		.fill("Hello! Today we record the screen.\n\nFirst, press the record button.");
	await expect(page.getByText("2 lines")).toBeVisible();
	await page.screenshot({ path: "test-results/narration-dialog.png", animations: "disabled" });
	await page.getByRole("button", { name: "Generate and add" }).click();

	await expect(page.getByText("Added 2 narration lines")).toBeVisible();
	expect(
		await page.evaluate(
			() => (window as unknown as { __narrationCalls: string[] }).__narrationCalls,
		),
	).toEqual(["Hello! Today we record the screen.", "First, press the record button."]);
	await page.screenshot({ path: "test-results/narration-timeline.png", animations: "disabled" });
	expect(errors).toEqual([]);
});

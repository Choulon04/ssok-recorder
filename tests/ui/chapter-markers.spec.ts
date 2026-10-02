import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("step markers add a screen-fixed step card and a YouTube chapter list", async ({
	page,
}) => {
	test.setTimeout(120000);
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await expect(page.getByRole("navigation", { name: "Editor tools" })).toBeVisible({
		timeout: 20000,
	});
	await expect
		.poll(() =>
			page
				.locator("video")
				.evaluateAll((videos) =>
					videos.some((video) => (video as HTMLVideoElement).readyState >= 2),
				),
		)
		.toBe(true);

	await page.getByRole("button", { name: /Add layer/i }).click();
	await page.getByRole("menuitem", { name: "Step marker (M)" }).click();

	// The card is rendered in the preview at the playhead.
	await expect(page.getByText("Step 1", { exact: true }).first()).toBeVisible();
	await page.screenshot({ path: "test-results/chapter-card.png", animations: "disabled" });

	await page.getByRole("button", { name: "Export", exact: true }).click();
	const copyButton = page.getByRole("button", { name: "Copy YouTube chapters (1)" });
	await expect(copyButton).toBeVisible();
	await page.screenshot({ path: "test-results/chapter-export-menu.png", animations: "disabled" });

	expect(errors).toEqual([]);
});

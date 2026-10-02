import { expect, test } from "@playwright/test";
import { installDesktopBridge, installDesktopBridgeOverrides } from "./bridge";

test("dashboard settings attribute Recordly and link the license", async ({ page }) => {
	test.setTimeout(120000);
	await installDesktopBridge(page);
	await installDesktopBridgeOverrides(page, () => {
		const opened: string[] = [];
		Object.assign(window, { __opened: opened });
		window.electronAPI.getAppVersion = async () => "0.1.0";
		window.electronAPI.openExternalUrl = async (url: string) => {
			opened.push(url);
			return { success: true };
		};
	});
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Home", exact: true }).click();
	await expect(page.getByText("Based on Recordly")).toBeVisible();
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	const about = page.getByRole("region", { name: "About" });
	await about.scrollIntoViewIfNeeded();
	await expect(about).toContainText("modified version of Recordly");
	await expect(about).toContainText("SsokRecorder 0.1.0");
	await about.getByRole("button", { name: "Open-source notices" }).click();
	await expect(about).toContainText("FFmpeg (ffmpeg-static) — GPL-3.0");
	await about.getByRole("button", { name: "Recordly on GitHub" }).click();
	await about.getByRole("button", { name: "AGPL-3.0 license text" }).click();
	expect(
		await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened),
	).toEqual([
		"https://github.com/webadderallorg/Recordly",
		"https://www.gnu.org/licenses/agpl-3.0.html",
	]);
	await page.screenshot({ path: "test-results/about.png", fullPage: true });
});

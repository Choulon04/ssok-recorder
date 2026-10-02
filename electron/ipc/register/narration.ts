import { ipcMain } from "electron";
import {
	getNarrationSettings,
	type NarrationSettings,
	saveNarrationSettings,
	synthesizeNarration,
} from "../narration/fishTts";
import { approveUserPath } from "../utils";

export function registerNarrationHandlers() {
	ipcMain.handle("narration:get-settings", async () => {
		try {
			return { success: true, settings: await getNarrationSettings() };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(
		"narration:save-settings",
		async (_, update: Partial<NarrationSettings> & { apiKey?: string | null }) => {
			try {
				return { success: true, settings: await saveNarrationSettings(update ?? {}) };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle("narration:synthesize", async (_, text: string) => {
		try {
			const result = await synthesizeNarration(typeof text === "string" ? text : "");
			// The editor plays and exports audio regions through the approved local-path server.
			approveUserPath(result.path);
			return { success: true, ...result };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});
}

import { createWriteStream } from "node:fs";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import { get as httpsGet } from "node:https";
import type Electron from "electron";
import path from "node:path";
import {
	getWhisperModel,
	WHISPER_MODELS,
	type WhisperModelId,
} from "../../../src/lib/whisperModels";
import { WHISPER_MODEL_DIR } from "../constants";

export function getWhisperModelPath(modelId: string | null | undefined) {
	return path.join(WHISPER_MODEL_DIR, getWhisperModel(modelId).fileName);
}

export function sendWhisperModelDownloadProgress(
	webContents: Electron.WebContents,
	payload: {
		modelId: WhisperModelId;
		status: "idle" | "downloading" | "downloaded" | "error";
		progress: number;
		path?: string | null;
		error?: string;
	},
) {
	webContents.send("whisper-small-model-download-progress", payload);
}

async function isReadable(filePath: string) {
	try {
		await fs.access(filePath, fsConstants.R_OK);
		return true;
	} catch {
		return false;
	}
}

export async function getWhisperModelStatus(modelId?: string | null) {
	const modelPath = getWhisperModelPath(modelId);
	const exists = await isReadable(modelPath);
	const downloaded: Partial<Record<WhisperModelId, string>> = {};
	for (const entry of WHISPER_MODELS) {
		const entryPath = getWhisperModelPath(entry.id);
		if (await isReadable(entryPath)) downloaded[entry.id] = entryPath;
	}
	return {
		success: true,
		modelId: getWhisperModel(modelId).id,
		exists,
		path: exists ? modelPath : null,
		downloaded,
	};
}

export function downloadFileWithProgress(
	url: string,
	destinationPath: string,
	onProgress: (progress: number) => void,
): Promise<void> {
	const request = (currentUrl: string, redirectCount = 0): Promise<void> => {
		return new Promise((resolve, reject) => {
			const req = httpsGet(currentUrl, { timeout: 30_000 }, (response) => {
				const statusCode = response.statusCode ?? 0;
				const location = response.headers.location;

				if (statusCode >= 300 && statusCode < 400 && location) {
					response.resume();
					if (redirectCount >= 5) {
						reject(new Error("Too many redirects while downloading Whisper model."));
						return;
					}

					const nextUrl = new URL(location, currentUrl).toString();
					void request(nextUrl, redirectCount + 1)
						.then(resolve)
						.catch(reject);
					return;
				}

				if (statusCode < 200 || statusCode >= 300) {
					response.resume();
					reject(new Error(`Whisper model download failed with status ${statusCode}.`));
					return;
				}

				const totalBytes = Number.parseInt(
					String(response.headers["content-length"] ?? "0"),
					10,
				);
				let downloadedBytes = 0;
				const fileStream = createWriteStream(destinationPath);

				response.on("data", (chunk: Buffer) => {
					downloadedBytes += chunk.length;
					if (Number.isFinite(totalBytes) && totalBytes > 0) {
						onProgress(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)));
					}
				});

				response.on("error", (error) => {
					fileStream.destroy(error);
				});

				fileStream.on("error", (error) => {
					response.destroy(error);
					reject(error);
				});

				fileStream.on("finish", () => {
					onProgress(100);
					resolve();
				});

				response.pipe(fileStream);
			});

			req.on("error", reject);
			req.on("timeout", () => {
				req.destroy(new Error("Whisper model download timed out."));
			});
		});
	};

	return request(url);
}

export async function downloadWhisperModel(
	webContents: Electron.WebContents,
	requestedModelId?: string | null,
): Promise<string> {
	const model = getWhisperModel(requestedModelId);
	const modelId = model.id;
	const modelPath = getWhisperModelPath(modelId);
	await fs.mkdir(WHISPER_MODEL_DIR, { recursive: true });
	const tempPath = `${modelPath}.download`;

	sendWhisperModelDownloadProgress(webContents, {
		modelId,
		status: "downloading",
		progress: 0,
		path: null,
	});

	try {
		await fs.rm(tempPath, { force: true });
		await downloadFileWithProgress(model.url, tempPath, (progress) => {
			sendWhisperModelDownloadProgress(webContents, {
				modelId,
				status: "downloading",
				progress,
				path: null,
			});
		});
		await fs.rename(tempPath, modelPath);
		sendWhisperModelDownloadProgress(webContents, {
			modelId,
			status: "downloaded",
			progress: 100,
			path: modelPath,
		});
		return modelPath;
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
		sendWhisperModelDownloadProgress(webContents, {
			modelId,
			status: "error",
			progress: 0,
			path: null,
			error: String(error),
		});
		throw error;
	}
}

export async function deleteWhisperModel(modelId?: string | null): Promise<void> {
	await fs.rm(getWhisperModelPath(modelId), { force: true });
}

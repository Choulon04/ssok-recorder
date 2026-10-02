import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { safeStorage } from "electron";
import { USER_DATA_PATH } from "../../appPaths";
import { getFfmpegBinaryPath, getFfprobeBinaryPath } from "../ffmpeg/binary";

const execFileAsync = promisify(execFile);

const FISH_TTS_URL = "https://api.fish.audio/v1/tts";
const NARRATION_SETTINGS_FILE = path.join(USER_DATA_PATH, "narration-settings.json");
export const NARRATION_DIR = path.join(USER_DATA_PATH, "narration");
const MAX_TEXT_LENGTH = 5_000;
const REQUEST_TIMEOUT_MS = 180_000;

export const DEFAULT_FISH_VOICE_ID = "773c8796d726413bb9273821fdc1a5f9";
export const DEFAULT_FISH_MODEL = "s2.1-pro";
export const DEFAULT_NARRATION_SPEED = 1.1;

export interface NarrationSettings {
	voiceId: string;
	model: string;
	speed: number;
}

/** What the renderer is allowed to see: never the key itself. */
export interface NarrationSettingsView extends NarrationSettings {
	hasApiKey: boolean;
}

interface StoredNarrationSettings extends NarrationSettings {
	/** API key encrypted with the OS keychain (Electron safeStorage), base64. */
	encryptedApiKey?: string;
}

const DEFAULT_SETTINGS: NarrationSettings = {
	voiceId: DEFAULT_FISH_VOICE_ID,
	model: DEFAULT_FISH_MODEL,
	speed: DEFAULT_NARRATION_SPEED,
};

function clampSpeed(value: unknown) {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(2, Math.max(0.5, value))
		: DEFAULT_NARRATION_SPEED;
}

function cleanString(value: unknown, fallback: string) {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function readStoredSettings(): Promise<StoredNarrationSettings> {
	try {
		const raw = JSON.parse(await fs.readFile(NARRATION_SETTINGS_FILE, "utf8"));
		return {
			voiceId: cleanString(raw.voiceId, DEFAULT_SETTINGS.voiceId),
			model: cleanString(raw.model, DEFAULT_SETTINGS.model),
			speed: clampSpeed(raw.speed),
			encryptedApiKey:
				typeof raw.encryptedApiKey === "string" ? raw.encryptedApiKey : undefined,
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function readApiKey(stored: StoredNarrationSettings): string | null {
	if (stored.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
		try {
			return safeStorage.decryptString(Buffer.from(stored.encryptedApiKey, "base64"));
		} catch {
			return null;
		}
	}
	return process.env.FISH_API_KEY?.trim() || null;
}

export async function getNarrationSettings(): Promise<NarrationSettingsView> {
	const stored = await readStoredSettings();
	return {
		voiceId: stored.voiceId,
		model: stored.model,
		speed: stored.speed,
		hasApiKey: Boolean(readApiKey(stored)),
	};
}

export async function saveNarrationSettings(
	update: Partial<NarrationSettings> & { apiKey?: string | null },
): Promise<NarrationSettingsView> {
	const stored = await readStoredSettings();
	const next: StoredNarrationSettings = {
		voiceId: cleanString(update.voiceId, stored.voiceId),
		model: cleanString(update.model, stored.model),
		speed: update.speed === undefined ? stored.speed : clampSpeed(update.speed),
		encryptedApiKey: stored.encryptedApiKey,
	};
	if (update.apiKey === null || update.apiKey === "") {
		next.encryptedApiKey = undefined;
	} else if (typeof update.apiKey === "string") {
		if (!safeStorage.isEncryptionAvailable()) {
			throw new Error("Secure storage is not available on this system.");
		}
		next.encryptedApiKey = safeStorage.encryptString(update.apiKey.trim()).toString("base64");
	}
	await fs.mkdir(path.dirname(NARRATION_SETTINGS_FILE), { recursive: true });
	await fs.writeFile(NARRATION_SETTINGS_FILE, JSON.stringify(next, null, "\t"), "utf8");
	return getNarrationSettings();
}

async function requestFishTts(
	text: string,
	settings: NarrationSettings,
	apiKey: string,
): Promise<Buffer> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(FISH_TTS_URL, {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				model: settings.model,
			},
			body: JSON.stringify({
				text,
				reference_id: settings.voiceId,
				format: "mp3",
				mp3_bitrate: 192,
				latency: "normal",
				temperature: 0.7,
				top_p: 0.7,
				prosody: { speed: settings.speed, volume: 0, normalize_loudness: true },
			}),
		});
		if (!response.ok) {
			const detail = (await response.text().catch(() => "")).slice(0, 200);
			if (response.status === 401) throw new Error("Fish Audio rejected the API key.");
			if (response.status === 402) throw new Error("Fish Audio credits are exhausted.");
			throw new Error(`Fish Audio TTS failed (HTTP ${response.status}) ${detail}`.trim());
		}
		const audio = Buffer.from(await response.arrayBuffer());
		if (audio.length < 1000) throw new Error("Fish Audio returned an empty audio file.");
		return audio;
	} finally {
		clearTimeout(timeout);
	}
}

async function probeDurationMs(filePath: string) {
	const { stdout } = await execFileAsync(getFfprobeBinaryPath(), [
		"-v",
		"error",
		"-show_entries",
		"format=duration",
		"-of",
		"csv=p=0",
		filePath,
	]);
	const seconds = Number.parseFloat(stdout.trim());
	return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
}

export interface SynthesizedNarration {
	path: string;
	durationMs: number;
	cached: boolean;
}

/**
 * Synthesizes one narration line to a loudness-normalized WAV in the narration folder.
 * Identical text + voice settings reuse the earlier file instead of spending credits again.
 */
export async function synthesizeNarration(text: string): Promise<SynthesizedNarration> {
	const trimmed = text.trim();
	if (!trimmed) throw new Error("Narration text is empty.");
	if (trimmed.length > MAX_TEXT_LENGTH) {
		throw new Error(`Narration text is longer than ${MAX_TEXT_LENGTH} characters.`);
	}
	const stored = await readStoredSettings();
	const apiKey = readApiKey(stored);
	if (!apiKey) throw new Error("Add a Fish Audio API key in narration settings first.");

	const hash = createHash("sha256")
		.update(JSON.stringify([trimmed, stored.voiceId, stored.model, stored.speed]))
		.digest("hex")
		.slice(0, 20);
	await fs.mkdir(NARRATION_DIR, { recursive: true });
	const wavPath = path.join(NARRATION_DIR, `narration-${hash}.wav`);
	try {
		await fs.access(wavPath);
		return { path: wavPath, durationMs: await probeDurationMs(wavPath), cached: true };
	} catch {
		// Not cached yet.
	}

	const mp3Path = path.join(NARRATION_DIR, `narration-${hash}.mp3`);
	await fs.writeFile(mp3Path, await requestFishTts(trimmed, stored, apiKey));
	try {
		// Trim leading/trailing silence so lines butt up against each other, then normalize.
		await execFileAsync(getFfmpegBinaryPath(), [
			"-y",
			"-loglevel",
			"error",
			"-i",
			mp3Path,
			"-ar",
			"48000",
			"-ac",
			"2",
			"-af",
			"silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11",
			wavPath,
		]);
	} finally {
		await fs.rm(mp3Path, { force: true });
	}
	return { path: wavPath, durationMs: await probeDurationMs(wavPath), cached: false };
}

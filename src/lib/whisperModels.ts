// Whisper models SsokRecorder can download. Shared by the main process (download/status)
// and the renderer (caption settings model picker).

export type WhisperModelId = "small" | "large-v3-turbo-q5_0" | "large-v3-turbo";

export interface WhisperModelInfo {
	id: WhisperModelId;
	fileName: string;
	url: string;
	sizeMb: number;
	label: string;
	koLabel: string;
}

const HUGGINGFACE_BASE_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

function model(
	id: WhisperModelId,
	sizeMb: number,
	label: string,
	koLabel: string,
): WhisperModelInfo {
	const fileName = `ggml-${id}.bin`;
	return { id, fileName, url: `${HUGGINGFACE_BASE_URL}/${fileName}`, sizeMb, label, koLabel };
}

export const WHISPER_MODELS: readonly WhisperModelInfo[] = [
	model("small", 466, "Small — fast", "Small — 빠름"),
	model(
		"large-v3-turbo-q5_0",
		547,
		"Large v3 Turbo (q5) — recommended",
		"Large v3 Turbo (q5) — 한국어 추천",
	),
	model("large-v3-turbo", 1549, "Large v3 Turbo — most accurate", "Large v3 Turbo — 가장 정확"),
];

// Korean recognition is markedly better on large-v3-turbo; the q5 quantization keeps the
// download close to the old small model.
export const DEFAULT_WHISPER_MODEL_ID: WhisperModelId = "large-v3-turbo-q5_0";

export function getWhisperModel(id: string | null | undefined): WhisperModelInfo {
	return (
		WHISPER_MODELS.find((entry) => entry.id === id) ??
		(WHISPER_MODELS.find((entry) => entry.id === DEFAULT_WHISPER_MODEL_ID) as WhisperModelInfo)
	);
}

/** Matches a model path (downloaded or user-picked) back to a catalog entry by file name. */
export function findWhisperModelByPath(
	modelPath: string | null | undefined,
): WhisperModelInfo | null {
	if (!modelPath) return null;
	const fileName = modelPath.split(/[\\/]/).pop()?.toLowerCase();
	return WHISPER_MODELS.find((entry) => entry.fileName === fileName) ?? null;
}

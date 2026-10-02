export interface BuiltInWallpaper {
	id: string;
	label: string;
	relativePath: string;
	publicPath: string;
}

const IMAGE_FILE_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const VIDEO_FILE_PATTERN = /\.(avi|m4v|mkv|mov|mp4|webm)$/i;

// Original SsokRecorder wallpapers (generated gradients). Projects that reference a
// wallpaper no longer bundled fall back to the default via resolveAvailableWallpaperPath.
export const BUILT_IN_WALLPAPERS: BuiltInWallpaper[] = [
	createWallpaperEntry("ssok-aurora.jpg", "Aurora"),
	createWallpaperEntry("ssok-ocean.jpg", "Ocean"),
	createWallpaperEntry("ssok-midnight.jpg", "Midnight"),
	createWallpaperEntry("ssok-grape.jpg", "Grape"),
	createWallpaperEntry("ssok-sunset.jpg", "Sunset"),
	createWallpaperEntry("ssok-coral.jpg", "Coral"),
	createWallpaperEntry("ssok-forest.jpg", "Forest"),
	createWallpaperEntry("ssok-graphite.jpg", "Graphite"),
	createWallpaperEntry("ssok-sky.jpg", "Sky"),
	createWallpaperEntry("ssok-mint.jpg", "Mint"),
	createWallpaperEntry("ssok-peach.jpg", "Peach"),
	createWallpaperEntry("ssok-lavender.jpg", "Lavender"),
];

export const WALLPAPER_PATHS = BUILT_IN_WALLPAPERS.map((wallpaper) => wallpaper.publicPath);
export const WALLPAPER_RELATIVE_PATHS = BUILT_IN_WALLPAPERS.map(
	(wallpaper) => wallpaper.relativePath,
);
export const DEFAULT_WALLPAPER_PATH = "/wallpapers/ssok-aurora.jpg";
export const DEFAULT_WALLPAPER_RELATIVE_PATH = "wallpapers/ssok-aurora.jpg";

function safeDecodeFileName(fileName: string) {
	try {
		return decodeURIComponent(fileName);
	} catch {
		return fileName;
	}
}

function getBundledWallpaperFileName(value: string) {
	if (!value.startsWith("/wallpapers/")) {
		return null;
	}

	const normalizedValue = value.split(/[?#]/)[0] ?? value;
	const fileName = normalizedValue.split("/").filter(Boolean).pop();
	return fileName ? safeDecodeFileName(fileName) : null;
}

export async function resolveAvailableWallpaperPath(wallpaper: string): Promise<string> {
	const bundledFileName = getBundledWallpaperFileName(wallpaper);
	if (
		!bundledFileName ||
		typeof window === "undefined" ||
		!window.electronAPI?.listAssetDirectory
	) {
		return wallpaper;
	}

	try {
		const result = await window.electronAPI.listAssetDirectory("wallpapers");
		if (!result.success || !result.files?.length) {
			return wallpaper;
		}

		return result.files.includes(bundledFileName) ? wallpaper : DEFAULT_WALLPAPER_PATH;
	} catch {
		return wallpaper;
	}
}

export function isVideoWallpaperSource(value: string): boolean {
	if (!value) {
		return false;
	}

	const normalizedValue = value.split("?")[0]?.toLowerCase() ?? value.toLowerCase();
	return VIDEO_FILE_PATTERN.test(normalizedValue);
}

function toWallpaperId(fileName: string) {
	return fileName
		.replace(/\.[^.]+$/, "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function toWallpaperLabel(fileName: string) {
	const baseName = fileName.replace(/\.[^.]+$/, "").trim();
	if (!baseName) {
		return "Wallpaper";
	}

	return baseName
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/\b\w/g, (match) => match.toUpperCase());
}

function createWallpaperEntry(
	fileName: string,
	label = toWallpaperLabel(fileName),
): BuiltInWallpaper {
	const encodedFileName = encodeURIComponent(fileName);
	return {
		id: toWallpaperId(fileName) || `wallpaper-${encodedFileName.toLowerCase()}`,
		label,
		relativePath: `wallpapers/${fileName}`,
		publicPath: `/wallpapers/${encodedFileName}`,
	};
}

export async function getAvailableWallpapers(): Promise<BuiltInWallpaper[]> {
	const fallbackWallpapers = BUILT_IN_WALLPAPERS;

	if (typeof window === "undefined" || !window.electronAPI?.listAssetDirectory) {
		return fallbackWallpapers;
	}

	try {
		const result = await window.electronAPI.listAssetDirectory("wallpapers");
		if (!result.success || !result.files?.length) {
			return fallbackWallpapers;
		}

		const discoveredFiles = new Set(
			result.files.filter(
				(fileName) =>
					IMAGE_FILE_PATTERN.test(fileName) || VIDEO_FILE_PATTERN.test(fileName),
			),
		);

		if (discoveredFiles.size === 0) {
			return fallbackWallpapers;
		}

		const curatedWallpapers = fallbackWallpapers.filter((wallpaper) =>
			discoveredFiles.has(wallpaper.relativePath.replace(/^wallpapers\//, "")),
		);

		return curatedWallpapers.length > 0 ? curatedWallpapers : fallbackWallpapers;
	} catch {
		return fallbackWallpapers;
	}
}

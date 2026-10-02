// SsokRecorder's own cursor artwork. The canvas sizes and hotspots match the set it
// replaced, so the renderer's size and anchor math is unchanged.
import closedHandUrl from "../../../assets/cursors/ssok/closedhand-1__50-46.svg";
import crosshairUrl from "../../../assets/cursors/ssok/crosshair-1__50-50.svg";
import textUrl from "../../../assets/cursors/ssok/ibeam-1__50-44.svg";
import notAllowedUrl from "../../../assets/cursors/ssok/notallowed-1__23-0.svg";
import openHandUrl from "../../../assets/cursors/ssok/openhand-1__55-57.svg";
import arrowUrl from "../../../assets/cursors/ssok/pointer-1__14-6.svg";
import pointerUrl from "../../../assets/cursors/ssok/pointinghand-1__40-10.svg";
import resizeEwUrl from "../../../assets/cursors/ssok/resizeeastwest-1__50-50.svg";
import resizeNsUrl from "../../../assets/cursors/ssok/resizenorthsouth-1__50-49.svg";
import type { CursorStyle, CursorTelemetryPoint } from "../types";

type CursorAssetKey = NonNullable<CursorTelemetryPoint["cursorType"]>;
type CursorSetStyle = Extract<CursorStyle, "macos" | "tahoe" | "tahoe-inverted" | "windows11">;

export type UploadedCursorAsset = {
	url: string;
	fallbackAnchor: {
		x: number;
		y: number;
	};
	preserveCanvas?: boolean;
};

function asset(
	url: string,
	hotspotX: number,
	hotspotY: number,
	options: Pick<UploadedCursorAsset, "preserveCanvas"> = {},
): UploadedCursorAsset {
	return {
		url,
		fallbackAnchor: {
			x: hotspotX / 100,
			y: hotspotY / 100,
		},
		...options,
	};
}

const ssokCursorSet: Record<CursorAssetKey, UploadedCursorAsset> = {
	arrow: asset(arrowUrl, 14, 6),
	text: asset(textUrl, 50, 44),
	pointer: asset(pointerUrl, 40, 10),
	crosshair: asset(crosshairUrl, 50, 50),
	"open-hand": asset(openHandUrl, 55, 57),
	"closed-hand": asset(closedHandUrl, 50, 46),
	"resize-ew": asset(resizeEwUrl, 50, 50),
	"resize-ns": asset(resizeNsUrl, 50, 49),
	"not-allowed": asset(notAllowedUrl, 23, 0),
};

/**
 * Every image cursor style uses the SsokRecorder set. "macos" and "windows11" stay as values
 * so projects saved with them still open, but the OS vendors' cursor artwork is not shipped.
 */
export const cursorSetAssets: Record<
	Exclude<CursorSetStyle, "tahoe-inverted">,
	Record<CursorAssetKey, UploadedCursorAsset>
> = {
	macos: ssokCursorSet,
	tahoe: ssokCursorSet,
	windows11: ssokCursorSet,
};

export const cursorStyleSizeMultipliers: Record<CursorSetStyle, number> = {
	macos: 1,
	tahoe: 1,
	"tahoe-inverted": 1,
	windows11: 1,
};

export function getCursorStyleSizeMultiplier(style: CursorStyle) {
	return style in cursorStyleSizeMultipliers
		? cursorStyleSizeMultipliers[style as CursorSetStyle]
		: 1;
}

export const uploadedCursorAssets = cursorSetAssets.tahoe;

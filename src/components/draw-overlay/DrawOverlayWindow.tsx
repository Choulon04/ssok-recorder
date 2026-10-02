import { useCallback, useEffect, useRef } from "react";
import {
	appendPenPoint,
	PEN_COLORS,
	type PenPoint,
	type PenStroke,
	type PenTool,
	redrawPenStrokes,
} from "./penStrokes";

export interface PenSettings {
	tool: PenTool;
	color: string;
	width: number;
}

export const DEFAULT_PEN_SETTINGS: PenSettings = { tool: "pen", color: PEN_COLORS[0], width: 6 };

const TOOL_KEYS: Record<string, PenTool> = { p: "pen", h: "highlighter", a: "arrow", r: "rect" };

/**
 * Full-screen transparent canvas shown over the recorded display while live pen is on.
 * It is deliberately chrome-free: everything drawn here ends up in the recording, so the
 * controls live in the (capture-protected) recording HUD instead.
 */
export function DrawOverlayWindow() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const strokesRef = useRef<PenStroke[]>([]);
	const activeStrokeRef = useRef<PenStroke | null>(null);
	const settingsRef = useRef<PenSettings>(DEFAULT_PEN_SETTINGS);

	const redraw = useCallback(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		const dpr = window.devicePixelRatio || 1;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const strokes = activeStrokeRef.current
			? [...strokesRef.current, activeStrokeRef.current]
			: strokesRef.current;
		redrawPenStrokes(ctx, strokes, canvas.width / dpr, canvas.height / dpr);
	}, []);

	const resize = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(window.innerWidth * dpr);
		canvas.height = Math.round(window.innerHeight * dpr);
		redraw();
	}, [redraw]);

	const undo = useCallback(() => {
		strokesRef.current = strokesRef.current.slice(0, -1);
		redraw();
	}, [redraw]);

	const clear = useCallback(() => {
		strokesRef.current = [];
		activeStrokeRef.current = null;
		redraw();
	}, [redraw]);

	const applySettings = useCallback((next: Partial<PenSettings>) => {
		settingsRef.current = { ...settingsRef.current, ...next };
	}, []);

	useEffect(() => {
		document.documentElement.style.background = "transparent";
		document.body.style.background = "transparent";
		resize();
		window.addEventListener("resize", resize);
		const offSettings = window.electronAPI.onLivePenSettings?.((settings) =>
			applySettings(settings),
		);
		const offCommand = window.electronAPI.onLivePenCommand?.((command) => {
			if (command === "undo") undo();
			else if (command === "clear") clear();
		});
		return () => {
			window.removeEventListener("resize", resize);
			offSettings?.();
			offCommand?.();
		};
	}, [applySettings, clear, resize, undo]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const key = event.key.toLowerCase();
			if (key === "escape") {
				void window.electronAPI.setLivePenActive?.(false);
			} else if ((event.ctrlKey || event.metaKey) && key === "z") {
				undo();
			} else if (key === "c" || key === "delete" || key === "backspace") {
				clear();
			} else if (TOOL_KEYS[key]) {
				void window.electronAPI.updateLivePenSettings?.({ tool: TOOL_KEYS[key] });
			} else if (/^[1-6]$/.test(key)) {
				void window.electronAPI.updateLivePenSettings?.({
					color: PEN_COLORS[Number(key) - 1],
				});
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [clear, undo]);

	const pointFromEvent = (event: React.PointerEvent): PenPoint => ({
		x: event.clientX,
		y: event.clientY,
	});

	const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (event.button !== 0) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		const point = pointFromEvent(event);
		activeStrokeRef.current = { ...settingsRef.current, points: [point] };
		redraw();
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const stroke = activeStrokeRef.current;
		if (!stroke) return;
		const point = pointFromEvent(event);
		// Shapes keep only their anchor and the current point; free strokes accumulate.
		stroke.points =
			stroke.tool === "arrow" || stroke.tool === "rect"
				? [stroke.points[0], point]
				: appendPenPoint(stroke.points, point);
		redraw();
	};

	const handlePointerUp = () => {
		const stroke = activeStrokeRef.current;
		if (!stroke) return;
		activeStrokeRef.current = null;
		strokesRef.current = [...strokesRef.current, stroke];
		redraw();
	};

	return (
		<canvas
			ref={canvasRef}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			style={{
				position: "fixed",
				inset: 0,
				width: "100vw",
				height: "100vh",
				cursor: "crosshair",
				touchAction: "none",
				background: "transparent",
			}}
		/>
	);
}

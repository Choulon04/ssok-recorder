export type PenTool = "pen" | "highlighter" | "arrow" | "rect";

export interface PenPoint {
	x: number;
	y: number;
}

export interface PenStroke {
	tool: PenTool;
	color: string;
	width: number;
	points: PenPoint[];
}

export const PEN_COLORS = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ffffff", "#111827"];
export const PEN_WIDTHS = [3, 6, 12];
/** Highlighters draw wider and translucent so the content underneath stays readable. */
export const HIGHLIGHTER_WIDTH_SCALE = 4;
export const HIGHLIGHTER_ALPHA = 0.35;

/** Drops points closer than `minDistance` px to keep long strokes light. */
export function appendPenPoint(points: PenPoint[], point: PenPoint, minDistance = 1.5) {
	const last = points[points.length - 1];
	if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) return points;
	return [...points, point];
}

function strokeWidth(stroke: PenStroke) {
	return stroke.tool === "highlighter" ? stroke.width * HIGHLIGHTER_WIDTH_SCALE : stroke.width;
}

function drawFreehand(ctx: CanvasRenderingContext2D, points: PenPoint[]) {
	if (points.length === 1) {
		ctx.lineTo(points[0].x + 0.01, points[0].y);
		return;
	}
	// Quadratic smoothing through midpoints gives a natural pen line.
	for (let index = 1; index < points.length - 1; index += 1) {
		const midX = (points[index].x + points[index + 1].x) / 2;
		const midY = (points[index].y + points[index + 1].y) / 2;
		ctx.quadraticCurveTo(points[index].x, points[index].y, midX, midY);
	}
	const last = points[points.length - 1];
	ctx.lineTo(last.x, last.y);
}

function drawArrow(ctx: CanvasRenderingContext2D, from: PenPoint, to: PenPoint, width: number) {
	ctx.lineTo(to.x, to.y);
	const angle = Math.atan2(to.y - from.y, to.x - from.x);
	const head = Math.max(14, width * 4);
	ctx.moveTo(to.x, to.y);
	ctx.lineTo(
		to.x - head * Math.cos(angle - Math.PI / 7),
		to.y - head * Math.sin(angle - Math.PI / 7),
	);
	ctx.moveTo(to.x, to.y);
	ctx.lineTo(
		to.x - head * Math.cos(angle + Math.PI / 7),
		to.y - head * Math.sin(angle + Math.PI / 7),
	);
}

export function drawPenStroke(ctx: CanvasRenderingContext2D, stroke: PenStroke) {
	const [first] = stroke.points;
	if (!first) return;
	const last = stroke.points[stroke.points.length - 1];
	ctx.save();
	ctx.strokeStyle = stroke.color;
	ctx.lineWidth = strokeWidth(stroke);
	ctx.lineCap = stroke.tool === "highlighter" ? "square" : "round";
	ctx.lineJoin = "round";
	ctx.globalAlpha = stroke.tool === "highlighter" ? HIGHLIGHTER_ALPHA : 1;
	ctx.beginPath();
	ctx.moveTo(first.x, first.y);
	if (stroke.tool === "arrow") drawArrow(ctx, first, last, stroke.width);
	else if (stroke.tool === "rect") ctx.rect(first.x, first.y, last.x - first.x, last.y - first.y);
	else drawFreehand(ctx, stroke.points);
	ctx.stroke();
	ctx.restore();
}

export function redrawPenStrokes(
	ctx: CanvasRenderingContext2D,
	strokes: readonly PenStroke[],
	width: number,
	height: number,
) {
	ctx.clearRect(0, 0, width, height);
	for (const stroke of strokes) drawPenStroke(ctx, stroke);
}

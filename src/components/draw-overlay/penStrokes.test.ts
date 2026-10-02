import { describe, expect, it, vi } from "vitest";
import { appendPenPoint, drawPenStroke, HIGHLIGHTER_ALPHA } from "./penStrokes";

function fakeContext() {
	const calls: string[] = [];
	const ctx = new Proxy({ globalAlpha: 1, lineWidth: 1 } as Record<string, unknown>, {
		get(target, key: string) {
			if (key in target) return target[key];
			return (...args: unknown[]) => calls.push(`${key}(${args.join(",")})`);
		},
		set(target, key: string, value) {
			target[key] = value;
			calls.push(`${key}=${value}`);
			return true;
		},
	});
	return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("pen strokes", () => {
	it("skips points that are too close together", () => {
		const points = appendPenPoint([{ x: 0, y: 0 }], { x: 0.5, y: 0.5 });
		expect(points).toHaveLength(1);
		expect(appendPenPoint(points, { x: 5, y: 0 })).toHaveLength(2);
	});

	it("draws highlighters wide and translucent", () => {
		const { ctx, calls } = fakeContext();
		drawPenStroke(ctx, {
			tool: "highlighter",
			color: "#facc15",
			width: 6,
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
			],
		});
		expect(calls).toContain(`globalAlpha=${HIGHLIGHTER_ALPHA}`);
		expect(calls).toContain("lineWidth=24");
		expect(calls).toContain("stroke()");
	});

	it("draws a box from the anchor to the latest point", () => {
		const { ctx, calls } = fakeContext();
		drawPenStroke(ctx, {
			tool: "rect",
			color: "#ef4444",
			width: 3,
			points: [
				{ x: 10, y: 20 },
				{ x: 60, y: 80 },
			],
		});
		expect(calls).toContain("rect(10,20,50,60)");
		vi.restoreAllMocks();
	});
});

import { Button, Tooltip } from "@heroui/react";
import {
	ArrowCounterClockwise,
	ArrowUpRight,
	Highlighter,
	PencilSimple,
	Square,
	Trash,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import { PEN_COLORS, type PenTool } from "../draw-overlay/penStrokes";
import styles from "./LaunchWindow.module.css";

type LivePenState = NonNullable<
	Awaited<ReturnType<NonNullable<typeof window.electronAPI.getLivePenState>>>
>;

const TOOLS: Array<{
	tool: PenTool;
	Icon: typeof PencilSimple;
	labelKey: string;
	fallback: string;
}> = [
	{ tool: "pen", Icon: PencilSimple, labelKey: "livePen.pen", fallback: "Pen (P)" },
	{
		tool: "highlighter",
		Icon: Highlighter,
		labelKey: "livePen.highlighter",
		fallback: "Highlighter (H)",
	},
	{ tool: "arrow", Icon: ArrowUpRight, labelKey: "livePen.arrow", fallback: "Arrow (A)" },
	{ tool: "rect", Icon: Square, labelKey: "livePen.rect", fallback: "Box (R)" },
];

/**
 * Pen controls in the recording HUD. The HUD is hidden from capture, so none of this shows
 * up in the recording; only the strokes on the live-pen overlay do.
 */
export function LivePenControls() {
	const t = useScopedT("launch");
	const [state, setState] = useState<LivePenState | null>(null);

	useEffect(() => {
		void window.electronAPI.getLivePenState?.().then(setState);
		return window.electronAPI.onLivePenState?.(setState);
	}, []);

	if (!state) return null;
	const actionClass = `size-9 min-w-9 rounded-full ${styles.electronNoDrag}`;
	const smallClass = `size-7 min-w-7 rounded-full ${styles.electronNoDrag}`;
	const update = (next: { tool?: PenTool; color?: string }) =>
		void window.electronAPI.updateLivePenSettings?.(next);

	return (
		<div className="flex items-center gap-1" role="group" aria-label="Live pen">
			<Tooltip>
				<Button
					isIconOnly
					variant={state.active ? "primary" : "ghost"}
					className={actionClass}
					aria-pressed={state.active}
					aria-label={t("livePen.toggle", "Live pen")}
					onPress={() => void window.electronAPI.setLivePenActive?.(!state.active)}
				>
					<PencilSimple weight="fill" className="size-4" />
				</Button>
				<Tooltip.Content>
					{t("livePen.toggleTip", "Draw on screen ({{shortcut}}) · Esc to finish", {
						shortcut: state.shortcut.replace("CommandOrControl", "Ctrl"),
					})}
				</Tooltip.Content>
			</Tooltip>
			{state.active && (
				<>
					{TOOLS.map(({ tool, Icon, labelKey, fallback }) => (
						<Button
							key={tool}
							isIconOnly
							variant={state.settings.tool === tool ? "secondary" : "ghost"}
							className={smallClass}
							aria-label={t(labelKey, fallback)}
							aria-pressed={state.settings.tool === tool}
							onPress={() => update({ tool })}
						>
							<Icon weight="bold" className="size-3.5" />
						</Button>
					))}
					<div className="mx-1 flex items-center gap-1">
						{PEN_COLORS.map((color, index) => (
							<button
								key={color}
								type="button"
								aria-label={t("livePen.color", "Color {{n}}", { n: index + 1 })}
								aria-pressed={state.settings.color === color}
								onClick={() => update({ color })}
								className={`size-4 rounded-full border ${styles.electronNoDrag} ${
									state.settings.color === color
										? "border-foreground ring-2 ring-foreground/40"
										: "border-foreground/20"
								}`}
								style={{ background: color }}
							/>
						))}
					</div>
					<Button
						isIconOnly
						variant="ghost"
						className={smallClass}
						aria-label={t("livePen.undo", "Undo (Ctrl+Z)")}
						onPress={() => void window.electronAPI.sendLivePenCommand?.("undo")}
					>
						<ArrowCounterClockwise weight="bold" className="size-3.5" />
					</Button>
					<Button
						isIconOnly
						variant="ghost"
						className={smallClass}
						aria-label={t("livePen.clear", "Clear (C)")}
						onPress={() => void window.electronAPI.sendLivePenCommand?.("clear")}
					>
						<Trash weight="bold" className="size-3.5" />
					</Button>
				</>
			)}
		</div>
	);
}

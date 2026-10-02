import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import type { useI18n } from "@/contexts/I18nContext";
import {
	type NarrationPlacementMode,
	placeNarrationLines,
	splitNarrationScript,
} from "./narrationPlacement";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	t: ReturnType<typeof useI18n>["t"];
	currentTimeMs: number;
	totalMs: number;
	chapterStartsMs: number[];
	/** Track index that holds no audio yet, so narration lines get their own row. */
	freeAudioTrackIndex: number;
	onAddNarrationLine: (
		span: { start: number; end: number },
		audioPath: string,
		trackIndex: number,
	) => void;
};

const SPEED_OPTIONS = ["0.9", "1.0", "1.1", "1.2", "1.3"];

export function NarrationDialog({
	open,
	onOpenChange,
	t,
	currentTimeMs,
	totalMs,
	chapterStartsMs,
	freeAudioTrackIndex,
	onAddNarrationLine,
}: Props) {
	const [script, setScript] = useState("");
	const [mode, setMode] = useState<NarrationPlacementMode>("sequential");
	const [hasApiKey, setHasApiKey] = useState(false);
	const [apiKeyDraft, setApiKeyDraft] = useState("");
	const [voiceId, setVoiceId] = useState("");
	const [speed, setSpeed] = useState("1.1");
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

	useEffect(() => {
		if (!open) return;
		void window.electronAPI.getNarrationSettings().then((result) => {
			if (!result.success || !result.settings) return;
			setHasApiKey(result.settings.hasApiKey);
			setVoiceId(result.settings.voiceId);
			setSpeed(result.settings.speed.toFixed(1));
		});
	}, [open]);

	useEffect(() => {
		if (chapterStartsMs.length === 0) setMode("sequential");
	}, [chapterStartsMs.length]);

	const lines = splitNarrationScript(script);
	const busy = progress !== null;

	const saveSettings = async (update: { apiKey?: string | null }) => {
		const result = await window.electronAPI.saveNarrationSettings({
			voiceId,
			speed: Number.parseFloat(speed),
			...update,
		});
		if (!result.success || !result.settings) {
			toast.error(
				result.error || t("editor.narration.saveFailed", "Could not save settings"),
			);
			return false;
		}
		setHasApiKey(result.settings.hasApiKey);
		return true;
	};

	const handleGenerate = async () => {
		if (lines.length === 0 || busy) return;
		if (!(await saveSettings(apiKeyDraft.trim() ? { apiKey: apiKeyDraft.trim() } : {}))) {
			return;
		}
		setApiKeyDraft("");
		setProgress({ done: 0, total: lines.length });

		const generated: Array<{ path: string; durationMs: number }> = [];
		try {
			for (const [index, line] of lines.entries()) {
				const result = await window.electronAPI.synthesizeNarration(line);
				if (!result.success || !result.path || !result.durationMs) {
					toast.error(
						result.error ||
							t("editor.narration.lineFailed", "Narration line {{n}} failed", {
								n: index + 1,
							}),
					);
					return;
				}
				generated.push({ path: result.path, durationMs: result.durationMs });
				setProgress({ done: index + 1, total: lines.length });
			}

			const timings = placeNarrationLines({
				durationsMs: generated.map((entry) => entry.durationMs),
				mode,
				startMs: currentTimeMs,
				chapterStartsMs,
				totalMs,
			});
			let placed = 0;
			let truncated = false;
			timings.forEach((timing, index) => {
				if (!timing) return;
				onAddNarrationLine(
					{ start: timing.startMs, end: timing.endMs },
					generated[index].path,
					freeAudioTrackIndex,
				);
				placed += 1;
				truncated ||= timing.truncated;
			});
			if (placed < lines.length || truncated) {
				toast.info(
					t(
						"editor.narration.partiallyPlaced",
						"Added {{placed}} of {{total}} lines; the rest ran past the end of the video.",
						{ placed, total: lines.length },
					),
				);
			} else {
				toast.success(
					t("editor.narration.added", "Added {{count}} narration lines", {
						count: placed,
					}),
				);
			}
			setScript("");
			onOpenChange(false);
		} finally {
			setProgress(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("editor.narration.title", "Add narration (TTS)")}</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{t(
							"editor.narration.description",
							"Each paragraph becomes one voice line on its own audio track. Separate paragraphs with a blank line.",
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="narration-script">
							{t("editor.narration.script", "Script")}
						</Label>
						<textarea
							id="narration-script"
							value={script}
							onChange={(event) => setScript(event.target.value)}
							disabled={busy}
							placeholder={t(
								"editor.narration.scriptPlaceholder",
								"Hello! Today we'll record the screen.\n\nFirst, press the record button.",
							)}
							className="min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
						/>
						<p className="text-right text-[11px] text-muted-foreground">
							{t("editor.narration.lineCount", "{{count}} lines", {
								count: lines.length,
							})}
						</p>
					</div>

					<div className="space-y-2">
						<Label>{t("editor.narration.placement", "Placement")}</Label>
						<ChoiceGroup
							aria-label={t("editor.narration.placement", "Placement")}
							value={mode}
							onValueChange={(value) => setMode(value as NarrationPlacementMode)}
						>
							<ChoiceItem value="sequential">
								{t(
									"editor.narration.placeSequential",
									"From playhead, back to back",
								)}
							</ChoiceItem>
							<ChoiceItem value="chapters" isDisabled={chapterStartsMs.length === 0}>
								{t(
									"editor.narration.placeChapters",
									"One per step marker ({{count}})",
									{
										count: chapterStartsMs.length,
									},
								)}
							</ChoiceItem>
						</ChoiceGroup>
					</div>

					<div className="grid grid-cols-[1fr_auto] gap-3">
						<div className="space-y-2">
							<Label htmlFor="narration-voice">
								{t("editor.narration.voice", "Fish Audio voice ID")}
							</Label>
							<Input
								id="narration-voice"
								value={voiceId}
								onChange={(event) => setVoiceId(event.target.value)}
								disabled={busy}
								className="h-9 w-full font-mono text-xs"
							/>
						</div>
						<div className="space-y-2">
							<Label>{t("editor.narration.speed", "Speed")}</Label>
							<ChoiceGroup
								aria-label={t("editor.narration.speed", "Speed")}
								value={speed}
								onValueChange={setSpeed}
								size="sm"
							>
								{SPEED_OPTIONS.map((option) => (
									<ChoiceItem key={option} value={option}>
										{option}×
									</ChoiceItem>
								))}
							</ChoiceGroup>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="narration-key">
							{t("editor.narration.apiKey", "Fish Audio API key")}
						</Label>
						<div className="flex items-center gap-2">
							<Input
								id="narration-key"
								type="password"
								autoComplete="off"
								value={apiKeyDraft}
								onChange={(event) => setApiKeyDraft(event.target.value)}
								disabled={busy}
								placeholder={
									hasApiKey
										? t(
												"editor.narration.apiKeySaved",
												"Saved — enter a new key to replace",
											)
										: t("editor.narration.apiKeyMissing", "Paste your API key")
								}
								className="h-9 flex-1"
							/>
							{hasApiKey && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={busy}
									onClick={() => void saveSettings({ apiKey: null })}
								>
									{t("editor.narration.removeKey", "Remove")}
								</Button>
							)}
						</div>
						<p className="text-[11px] text-muted-foreground">
							{t(
								"editor.narration.apiKeyNote",
								"Stored encrypted on this computer and only sent to api.fish.audio.",
							)}
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={busy}
					>
						{t("common.actions.cancel", "Cancel")}
					</Button>
					<Button
						type="button"
						onClick={() => void handleGenerate()}
						disabled={busy || lines.length === 0 || (!hasApiKey && !apiKeyDraft.trim())}
					>
						{progress
							? t(
									"editor.narration.generating",
									"Generating {{done}}/{{total}}…",
									progress,
								)
							: t("editor.narration.generate", "Generate and add")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

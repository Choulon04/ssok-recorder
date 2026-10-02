import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useScopedT } from "@/contexts/I18nContext";

// SsokRecorder is a modified version of Recordly (AGPL-3.0). Recordly's license requires
// attributing it in the user-facing UI as well as the repository; keep this screen.
export const UPSTREAM_REPOSITORY_URL = "https://github.com/webadderallorg/Recordly";
/** Where recipients get SsokRecorder's complete corresponding source (AGPL-3.0 §6). */
export const SOURCE_REPOSITORY_URL = "https://github.com/Choulon04/ssok-recorder";
export const AGPL_LICENSE_URL = "https://www.gnu.org/licenses/agpl-3.0.html";

const THIRD_PARTY = [
	{ name: "Recordly", license: "AGPL-3.0", note: "webadderall" },
	{ name: "OpenScreen", license: "AGPL-3.0", note: "Siddharth Vaddem" },
	{ name: "Electron", license: "MIT", note: "" },
	{ name: "FFmpeg (ffmpeg-static)", license: "GPL-3.0", note: "" },
	{ name: "whisper.cpp / ggml", license: "MIT", note: "" },
	{ name: "Voom", license: "MIT", note: "Aritro Paul" },
	{ name: "Solar Icon Set", license: "CC BY 4.0", note: "480 Design" },
	{ name: "Phosphor Icons", license: "MIT", note: "" },
	{ name: "DM Sans", license: "OFL-1.1", note: "" },
];

export function AboutAttribution() {
	const t = useScopedT("common");
	const [version, setVersion] = useState<string | null>(null);
	const [showNotices, setShowNotices] = useState(false);

	useEffect(() => {
		window.electronAPI
			?.getAppVersion?.()
			.then(setVersion)
			.catch(() => undefined);
	}, []);

	const open = (url: string) => void window.electronAPI?.openExternalUrl?.(url);

	return (
		<section aria-label={t("about.title", "About")} className="mt-10 space-y-3 border-t pt-6">
			<h2 className="text-sm font-semibold">
				{t("about.title", "About")} · {t("app.name", "SsokRecorder")}
				{version ? ` ${version}` : ""}
			</h2>
			<p className="text-sm text-muted-foreground">
				{t(
					"about.basedOn",
					"SsokRecorder is a modified version of Recordly, an open-source screen recorder by webadderall. Recordly started as a fork of OpenScreen by Siddharth Vaddem.",
				)}
			</p>
			<p className="text-sm text-muted-foreground">
				{t(
					"about.license",
					"It is distributed under the GNU Affero General Public License v3.0, which gives you the right to receive its source code.",
				)}
			</p>
			<div className="flex flex-wrap gap-2">
				<Button variant="secondary" size="sm" onClick={() => open(SOURCE_REPOSITORY_URL)}>
					{t("about.source", "SsokRecorder source code")}
				</Button>
				<Button variant="secondary" size="sm" onClick={() => open(UPSTREAM_REPOSITORY_URL)}>
					{t("about.upstream", "Recordly on GitHub")}
				</Button>
				<Button variant="secondary" size="sm" onClick={() => open(AGPL_LICENSE_URL)}>
					{t("about.licenseText", "AGPL-3.0 license text")}
				</Button>
				<Button variant="ghost" size="sm" onClick={() => setShowNotices((value) => !value)}>
					{t("about.notices", "Open-source notices")}
				</Button>
			</div>
			{showNotices && (
				<ul className="space-y-1 text-xs text-muted-foreground">
					{THIRD_PARTY.map((entry) => (
						<li key={entry.name}>
							{entry.name} — {entry.license}
							{entry.note ? ` (${entry.note})` : ""}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

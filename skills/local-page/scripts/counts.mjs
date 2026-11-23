import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, platform, release } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
// server/counts.ts
/** Where the report and the version check go. The one place these addresses are written. */
const API = process.env.PARIVAL_API ?? "https://api.grownoli.com";
/** Where a contribution goes. The one place this address is written. */
const SUPPORT_URL = "https://buymeacoffee.com/lightsabersx2";
/** The errors that are counted, by code. An error's own text is never kept. */
const ERROR_CODES = [
	"render_failed",
	"export_failed",
	"critique_malformed",
	"verdict_missing"
];
const home = () => process.env.PARIVAL_HOME ?? join(homedir(), ".config", "parival-by-grownoli");
const read = (name) => {
	try {
		return JSON.parse(readFileSync(join(home(), name), "utf8"));
	} catch {
		return {};
	}
};
function write(name, data) {
	mkdirSync(home(), { recursive: true });
	const tmp = join(home(), `${name}.${process.pid}.tmp`);
	writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
	renameSync(tmp, join(home(), name));
}
const whole = (v) => Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
function readCounts() {
	const c = read("counts.json");
	const errors = {};
	for (const code of ERROR_CODES) if (whole(c.errors?.[code])) errors[code] = whole(c.errors?.[code]);
	return {
		runs: whole(c.runs),
		ads: whole(c.ads),
		formats: whole(c.formats),
		loopsKept: whole(c.loopsKept),
		loopsLost: whole(c.loopsLost),
		loopsEqual: whole(c.loopsEqual),
		studioExports: whole(c.studioExports),
		runMinutes: (Array.isArray(c.runMinutes) ? c.runMinutes : []).map(whole).slice(-200),
		errors
	};
}
/** Adds to the totals. Counting never stops the work it counts: a folder that cannot be written is ignored. */
function count(add) {
	try {
		const c = readCounts();
		for (const k of [
			"runs",
			"ads",
			"formats",
			"loopsKept",
			"loopsLost",
			"loopsEqual",
			"studioExports"
		]) c[k] += whole(add[k]);
		if (add.error && ERROR_CODES.includes(add.error)) c.errors[add.error] = (c.errors[add.error] ?? 0) + 1;
		if (add.runMinutes !== void 0) c.runMinutes = [...c.runMinutes, whole(add.runMinutes)].slice(-200);
		write("counts.json", c);
	} catch {}
}
function readSettings() {
	const s = read("settings.json");
	return {
		statistics: s.statistics === true && typeof s.installId === "string",
		...typeof s.installId === "string" && { installId: s.installId },
		...s.noticeShown && { noticeShown: s.noticeShown },
		...s.lastReport && { lastReport: s.lastReport },
		...typeof s.refused === "string" && { refused: s.refused },
		...s.latestVersion && { latestVersion: s.latestVersion },
		support: {
			asks: whole(s.support?.asks),
			lastAt: whole(s.support?.lastAt),
			supported: s.support?.supported === true
		},
		openedRuns: Array.isArray(s.openedRuns) ? s.openedRuns.map(String).slice(-500) : []
	};
}
function saveSettings(change) {
	const s = readSettings();
	change(s);
	try {
		write("settings.json", s);
	} catch {}
	return s;
}
/** The switch. Off deletes the random ID on this computer and sets the totals back to zero, so that a new ID never
* arrives carrying the old ID's totals and the two cannot be matched. On again makes a new ID. Turning the switch on is itself the choice to share. */
function setStatistics(on) {
	if (!on && readSettings().installId) try {
		write("counts.json", {
			...readCounts(),
			runs: 0,
			ads: 0,
			formats: 0,
			loopsKept: 0,
			loopsLost: 0,
			loopsEqual: 0,
			studioExports: 0,
			runMinutes: [],
			errors: {}
		});
	} catch {}
	return saveSettings((s) => {
		s.statistics = on;
		if (!on) {
			delete s.installId;
			delete s.refused;
		} else {
			s.noticeShown ??= (/* @__PURE__ */ new Date()).toISOString();
			s.installId ??= randomUUID();
		}
	});
}
/** The person answered the first-open question: share, or do not share. */
function answerNotice(statistics, now = /* @__PURE__ */ new Date()) {
	return saveSettings((s) => {
		s.noticeShown ??= now.toISOString();
		s.statistics = statistics;
		if (!statistics) delete s.installId;
		else s.installId ??= randomUUID();
	});
}
const median = (xs) => {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
/** The operating system and its version in the few characters Grownoli accepts, such as "macOS 15.6". */
let os;
function osName() {
	if (os) return os;
	let name = `${platform()} ${release()}`;
	if (platform() === "darwin") try {
		name = `macOS ${execFileSync("sw_vers", ["-productVersion"], {
			encoding: "utf8",
			timeout: 3e3
		}).trim()}`;
	} catch {}
	else if (platform() === "win32") name = `Windows ${release()}`;
	else if (platform() === "linux") name = `Linux ${release()}`;
	return os = name.replace(/[^A-Za-z0-9 ._-]/g, "").slice(0, 40) || "unknown";
}
/** The next report, or null when none will be sent: the person has not chosen to share. */
function report(version) {
	const s = readSettings();
	if (!s.statistics || !s.noticeShown || !s.installId) return null;
	const c = readCounts();
	return {
		installId: s.installId,
		pluginVersion: version,
		os: osName(),
		node: Number(process.versions.node.split(".")[0]),
		runs: c.runs,
		ads: c.ads,
		formats: c.formats,
		loopsKept: c.loopsKept,
		loopsLost: c.loopsLost,
		loopsEqual: c.loopsEqual,
		studioExports: c.studioExports,
		minutesPerRun: median(c.runMinutes),
		errors: c.errors
	};
}
/** The exact bytes of a report, as they are sent and as Statistics Report shows them. */
const reportBytes = (r) => JSON.stringify(r, null, 2);
const DAY = 864e5;
const SUPPORT_AFTER_RUNS = 3;
const SUPPORT_INTERVAL_DAYS = 7;
const SUPPORTER_INTERVAL_DAYS = 45;
/** Whether the donation ask is due, with this many finished runs. */
function supportDue(state, finishedRuns, now) {
	if (state.supported) return now - state.lastAt >= 45 * DAY;
	if (state.asks === 0) return finishedRuns >= 3;
	return now - state.lastAt >= 7 * DAY;
}
/** Whether `a` is a later version than `b`, by its numbers: 0.10.0 is later than 0.9.2. */
function laterVersion(a, b) {
	const [x, y] = [a ?? "", b].map((v) => v.split(".").map((n) => parseInt(n, 10) || 0));
	for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
	return false;
}
export { API, ERROR_CODES, SUPPORTER_INTERVAL_DAYS, SUPPORT_AFTER_RUNS, SUPPORT_INTERVAL_DAYS, SUPPORT_URL, answerNotice, count, home, laterVersion, osName, readCounts, readSettings, report, reportBytes, saveSettings, setStatistics, supportDue };

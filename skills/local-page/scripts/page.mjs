import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readFile, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { execFile, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
// server/feedback.ts
function byVersion(fb, latest) {
	const out = {};
	for (const [k, v] of Object.entries(fb?.versions ?? {})) out[Number(k)] = { ...v };
	if (fb && (fb.rating || fb.note)) {
		const n = fb.round ?? latest;
		out[n] = {
			...fb.rating && { rating: fb.rating },
			...fb.note && { note: fb.note },
			...out[n]
		};
	}
	return out;
}
function applyVersion(fb, latest, round, patch) {
	const all = byVersion(fb, latest);
	const v = { ...all[round] };
	if (patch.rating !== void 0) patch.rating ? v.rating = patch.rating : delete v.rating;
	if (patch.note !== void 0) patch.note ? v.note = patch.note : delete v.note;
	if (patch.pins !== void 0) patch.pins.length ? v.pins = patch.pins : delete v.pins;
	all[round] = v;
	const versions = {};
	for (const [k, x] of Object.entries(all)) if (x.rating || x.note || x.pins?.length) versions[k] = x;
	return { versions };
}
// server/critic.ts
function criticSummary(ads) {
	const all = {};
	for (const ad of ads) for (const r of ad.rounds) for (const v of Object.values(r.critique?.scores ?? {})) if (typeof v === "number") (all[r.n] ??= []).push(v);
	const scores = {};
	let best = null;
	for (const n of Object.keys(all).map(Number).sort((a, b) => a - b)) {
		scores[n] = Math.round(all[n].reduce((s, v) => s + v, 0) / all[n].length * 100) / 100;
		if (best === null || scores[n] >= scores[best]) best = n;
	}
	return {
		scores,
		best
	};
}
const LOOPS = 3;
/** Locked: the newest critic scored every line 4 or more and named no defect, so the ad stays as it is. */
function locked(ad) {
	const c = ad.rounds[ad.rounds.length - 1]?.critique;
	const scores = Object.values(c?.scores ?? {});
	return scores.length > 0 && scores.every((v) => v >= 4) && !c?.defects?.length;
}
function setStatus(ads, lastChange, now = Date.now()) {
	const flat = ads.every((a) => a.rounds.every((r) => !r.image.includes("/loop-")));
	const finished = ads.length > 0 && (flat || ads.every((a) => a.rounds.length + (a.rejected ?? 0) >= LOOPS || locked(a)));
	if (now - lastChange < 12e5) return "working";
	return finished ? "done" : "unfinished";
}
// server/scan.ts
const FORMAT = /^\d+x\d+(-[\w-]+)?$/;
const LOOP = /^loop-(\d+)$/;
const projectKey = (company) => company.trim().toLowerCase().replace(/[\s_]+/g, "-");
const titleCase = (key) => key.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
async function entries(dir) {
	try {
		return await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
}
const mtime = async (p) => {
	try {
		return (await stat(p)).mtimeMs;
	} catch {
		return 0;
	}
};
async function readJson$1(file) {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch {
		return;
	}
}
const campaign = (run) => {
	const w = run.replace(/^\d{4}-\d{2}-\d{2}-?/, "").replace(/-/g, " ").trim();
	return w && w.charAt(0).toUpperCase() + w.slice(1);
};
/** The kept loop for `format` from the run's kept.json, whose keys are the format or its label after the ratio. */
function keptRound(kept, format, rounds) {
	const loop = kept[format] ?? kept[format.replace(/^\d+x\d+-/, "")];
	const n = Number(LOOP.exec(loop ?? "")?.[1]);
	return rounds.some((r) => r.n === n) ? n : void 0;
}
async function scanSet(outDir, run, company) {
	const rel = `${run}/${company}`;
	const dir = join(outDir, run, company);
	const items = await entries(dir);
	const names = new Set(items.map((e) => e.name));
	const keptMap = await readJson$1(join(outDir, run, "kept.json")) ?? {};
	const title = (await readJson$1(join(outDir, run, "run.json")))?.title?.trim();
	const manifest = await readJson$1(join(dir, "manifest.json")) ?? [];
	const ads = [];
	let lastChange = 0;
	const formats = /* @__PURE__ */ new Set();
	for (const e of items) {
		const f = e.name.replace(/\.png$/, "");
		if (FORMAT.test(f)) formats.add(f);
	}
	for (const format of [...formats].sort(byFormat)) {
		let rounds = [];
		let rejected = 0;
		const lost = [];
		if (names.has(`${format}.png`)) rounds = [{
			n: 1,
			image: `${rel}/${format}.png`
		}];
		else {
			for (const l of await entries(join(dir, format))) {
				const m = LOOP.exec(l.name);
				if (!m || !l.isDirectory()) continue;
				const loopDir = join(dir, format, l.name);
				lastChange = Math.max(lastChange, await mtime(loopDir));
				const files = new Set((await entries(loopDir)).map((x) => x.name));
				for (const f of ["ad.png", "critique.json"]) if (files.has(f)) lastChange = Math.max(lastChange, await mtime(join(loopDir, f)));
				if (!files.has("ad.png")) continue;
				const critique = files.has("critique.json") ? await readJson$1(join(loopDir, "critique.json")) : void 0;
				rounds.push({
					n: Number(m[1]),
					image: `${rel}/${format}/${l.name}/ad.png`,
					...critique && { critique }
				});
			}
			rounds.sort((a, b) => a.n - b.n);
			for (const l of await entries(join(dir, format, "rejected"))) {
				const m = LOOP.exec(l.name);
				if (!m || !l.isDirectory()) continue;
				rejected++;
				if (await mtime(join(dir, format, "rejected", l.name, "ad.png")) > 0) lost.push({
					n: Number(m[1]),
					image: `${rel}/${format}/rejected/${l.name}/ad.png`
				});
			}
			lost.sort((a, b) => a.n - b.n);
		}
		if (!rounds.length) continue;
		const m = manifest.find((x) => x.format === format);
		const text = m && {
			headline: m.headline,
			subheadline: m.subheadline,
			cta: m.cta,
			photo_source_url: m.photo_source_url
		};
		const kept = keptRound(keptMap, format, rounds);
		ads.push({
			format,
			rounds,
			...text && { text },
			...rejected && { rejected },
			...lost.length && { lost },
			...kept && { kept }
		});
	}
	const started = [
		"research.md",
		"briefs.json",
		"brand.md",
		"notes"
	].some((n) => names.has(n));
	if (!ads.length && !started) return null;
	if (!ads.length) lastChange = await mtime(dir);
	const feedback = await readJson$1(join(dir, "feedback.json")) ?? { ads: {} };
	return {
		set: {
			id: rel,
			run,
			company,
			date: /\d{4}-\d{2}-\d{2}/.exec(run)?.[0] ?? "",
			ads,
			maxRound: Math.max(0, ...ads.flatMap((a) => a.rounds.map((r) => r.n))),
			critic: criticSummary(ads),
			status: setStatus(ads, lastChange),
			...names.has("notes.md") && { notes: `${rel}/notes.md` },
			...(title || campaign(run)) && { label: title || campaign(run) },
			feedback: {
				...feedback,
				ads: feedback.ads ?? {}
			}
		},
		name: manifest.find((x) => x.company)?.company
	};
}
const ORDER = [
	"1x1",
	"3x4",
	"4x5",
	"9x16",
	"16x9",
	"4x3"
];
function byFormat(a, b) {
	const i = (f) => ORDER.includes(f.split("-")[0]) ? ORDER.indexOf(f.split("-")[0]) : ORDER.length;
	const slot = (f) => f.split("-").slice(1).join("-");
	return slot(a).localeCompare(slot(b)) || i(a) - i(b) || a.localeCompare(b);
}
/** Newest set first: by the date in the run's name, then by the run's name. */
const newerFirst = (a, b) => b.date.localeCompare(a.date) || b.run.localeCompare(a.run);
async function scanOut(outDir) {
	const byKey = /* @__PURE__ */ new Map();
	for (const run of await entries(outDir)) {
		if (!run.isDirectory() || run.name.startsWith(".")) continue;
		for (const company of await entries(join(outDir, run.name))) {
			if (!company.isDirectory() || company.name.startsWith(".")) continue;
			const found = await scanSet(outDir, run.name, company.name);
			if (!found) continue;
			const key = projectKey(company.name);
			const p = byKey.get(key) ?? {
				key,
				name: titleCase(key),
				sets: []
			};
			if (found.name) p.name = found.name;
			p.sets.push(found.set);
			byKey.set(key, p);
		}
	}
	const projects = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
	for (const p of projects) p.sets.sort(newerFirst);
	return projects;
}
// server/store.ts
const notSet = (id) => /* @__PURE__ */ new Error(`not a set: ${id}`);
/** The set's folder, after checking that it is one, inside the runs folder (symlinks followed). */
async function setDir(outDir, id) {
	const parts = id.split("/");
	if (parts.length !== 2 || parts.some((p) => !p || p === "." || p === ".." || p.includes("\\"))) throw notSet(id);
	try {
		const root = await realpath(outDir);
		const dir = await realpath(join(root, ...parts));
		const rel = relative(root, dir);
		if (rel.split(sep).length !== 2 || rel.startsWith("..") || !(await stat(dir)).isDirectory()) throw notSet(id);
		return dir;
	} catch {
		throw notSet(id);
	}
}
/** A file inside the runs folder to serve read-only, or null. */
async function fileInOut(outDir, rel) {
	try {
		const root = await realpath(outDir);
		const file = await realpath(join(root, rel));
		return file.startsWith(root + sep) && (await stat(file)).isFile() ? file : null;
	} catch {
		return null;
	}
}
/** "Show in Finder": the disk paths of these files or folders, or null if any is missing or lies outside the runs folder. */
async function revealPaths(outDir, rels) {
	if (!rels.length) return null;
	const found = [];
	for (const rel of rels) try {
		const root = await realpath(outDir);
		const file = await realpath(join(root, rel));
		if (!rel || !file.startsWith(root + sep)) return null;
		found.push(file);
	} catch {
		return null;
	}
	return found;
}
async function readJson(file, fallback) {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch {
		return fallback;
	}
}
async function writeJson(file, data) {
	const tmp = `${file}.${process.pid}.tmp`;
	await writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
	await rename(tmp, file);
}
async function saveFeedback(outDir, id, patch) {
	const file = join(await setDir(outDir, id), "feedback.json");
	const fb = await readJson(file, { ads: {} });
	fb.ads ??= {};
	if (patch.format) {
		const latest = patch.latest ?? patch.round ?? 1;
		fb.ads[patch.format] = applyVersion(fb.ads[patch.format], latest, patch.round ?? latest, {
			rating: patch.rating,
			note: patch.note,
			pins: patch.pins
		});
	}
	if (patch.setNote !== void 0) fb.set_note = patch.setNote;
	if (patch.setRating !== void 0) fb.set_rating = patch.setRating;
	fb.updated = (/* @__PURE__ */ new Date()).toISOString();
	await writeJson(file, fb);
	return fb;
}
// server/thumb.ts
const run = promisify(execFile);
/** The path of a JPEG of `file` whose longest side is at most `size`, made on first ask; null where sips is missing. */
async function thumbnail(file, size, cacheDir) {
	const src = await stat(file);
	const out = join(cacheDir, `${createHash("sha1").update(`${file}:${src.mtimeMs}:${size}`).digest("hex")}.jpg`);
	try {
		await stat(out);
		return out;
	} catch {}
	await mkdir(cacheDir, { recursive: true });
	try {
		await run("sips", [
			"-s",
			"format",
			"jpeg",
			"-s",
			"formatOptions",
			"82",
			"-Z",
			String(size),
			file,
			"--out",
			out
		]);
		return out;
	} catch {
		return null;
	}
}
// server/main.ts
const SELF = fileURLToPath(import.meta.url);
const APP = join(dirname(SELF), "..", "app");
const IDLE_MS = 36e5;
const TYPES = {
	html: "text/html; charset=utf-8",
	js: "text/javascript",
	css: "text/css",
	svg: "image/svg+xml",
	woff2: "font/woff2",
	woff: "font/woff",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	md: "text/plain; charset=utf-8",
	json: "application/json",
	txt: "text/plain; charset=utf-8"
};
/** Files of a run the page may show: pictures, notes and data. An ad's HTML is never served. */
const RUN_FILES = /* @__PURE__ */ new Set([
	"png",
	"jpg",
	"jpeg",
	"webp",
	"md",
	"json"
]);
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const statePath = (runs) => join(runs, ".parival", "page.json");
const readState = (runs) => {
	try {
		return JSON.parse(readFileSync(statePath(runs), "utf8"));
	} catch {
		return null;
	}
};
const alive = (pid) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};
const url = (port) => `http://127.0.0.1:${port}/`;
async function answers(port, runs) {
	try {
		const r = await fetch(`${url(port)}api/ping`, { signal: AbortSignal.timeout(1500) });
		return r.ok && (await r.json()).runs === runs;
	} catch {
		return false;
	}
}
function send(res, status, body) {
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Cache-Control": "no-store"
	});
	res.end(JSON.stringify(body));
}
async function body(req) {
	let raw = "";
	for await (const chunk of req) {
		raw += chunk;
		if (raw.length > 1e5) throw new Error("too large");
	}
	return JSON.parse(raw || "{}");
}
function serve(runs, first) {
	const thumbs = join(tmpdir(), "parival-thumbs");
	const app = /* @__PURE__ */ new Map();
	for (const f of readdirSync(APP, {
		recursive: true,
		withFileTypes: true
	})) if (f.isFile()) app.set("/" + relative(APP, join(f.parentPath, f.name)).split("\\").join("/"), readFileSync(join(f.parentPath, f.name)));
	let port = first;
	let last = Date.now();
	const ROOT = join(dirname(SELF), "..", "..", "..");
	for (const [name, file] of [["/about/licence.txt", "LICENSE"], ["/about/third-party-notices.txt", "THIRD_PARTY_NOTICES.md"]]) try {
		app.set(name, readFileSync(join(ROOT, file)));
	} catch {}
	async function api(req, res, path, query) {
		const post = req.method === "POST";
		if (post && req.headers["content-type"] !== "application/json") return send(res, 415, { error: "json only" });
		if (post && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(res, 403, { error: "wrong origin" });
		if (path === "/ping") return send(res, 200, { runs });
		if (path === "/list") return send(res, 200, await scanOut(runs));
		if (path === "/file") {
			const rel = query.get("path") ?? "";
			const ext = rel.split(".").pop()?.toLowerCase() ?? "";
			let file = RUN_FILES.has(ext) && !rel.split("/").some((p) => p.startsWith(".")) ? await fileInOut(runs, rel) : null;
			if (!file) return send(res, 404, { error: "not found" });
			let type = TYPES[ext];
			const small = query.has("small") && ext === "png" ? await thumbnail(file, 960, thumbs) : null;
			if (small) [file, type] = [small, "image/jpeg"];
			res.writeHead(200, {
				"Content-Type": type,
				"Cache-Control": "no-cache",
				"X-Content-Type-Options": "nosniff"
			});
			createReadStream(file).pipe(res);
			return;
		}
		if (path === "/feedback" && post) {
			const { set, ...patch } = await body(req);
			return send(res, 200, await saveFeedback(runs, String(set), patch));
		}
		if (path === "/reveal" && post) {
			const { paths } = await body(req);
			const found = Array.isArray(paths) ? await revealPaths(runs, paths.map(String)) : null;
			if (!found) return send(res, 404, { error: "not found" });
			const isDir = (await stat(found[0])).isDirectory();
			if (process.platform === "darwin") execFile("open", isDir ? [found[0]] : ["-R", found[0]], () => {});
			else if (process.platform === "win32") execFile("explorer", [isDir ? found[0] : dirname(found[0])], () => {});
			else execFile("xdg-open", [isDir ? found[0] : dirname(found[0])], () => {});
			return send(res, 200, { ok: true });
		}
		send(res, 404, { error: "not found" });
	}
	const server = createServer((req, res) => {
		last = Date.now();
		const u = new URL(req.url ?? "/", "http://x");
		if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return send(res, 403, { error: "wrong host" });
		if (u.pathname.startsWith("/api/")) return void api(req, res, u.pathname.slice(4), u.searchParams).catch((e) => send(res, /not a set/.test(e.message) ? 400 : 500, { error: e.message }));
		if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "read only" });
		const name = u.pathname === "/" ? "/index.html" : u.pathname;
		const file = app.get(name);
		const type = TYPES[extname(name).slice(1).toLowerCase()];
		if (!file || !type) return send(res, 404, { error: "not found" });
		res.writeHead(200, {
			"Content-Type": type,
			"Cache-Control": u.pathname.startsWith("/assets/") ? "max-age=31536000, immutable" : "no-cache",
			"Content-Security-Policy": CSP,
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy": "no-referrer"
		});
		res.end(file);
	});
	server.on("error", (e) => {
		if (e.code === "EADDRINUSE" && port < first + 20) server.listen(++port, "127.0.0.1");
		else {
			console.error(e.message);
			process.exit(1);
		}
	});
	server.on("listening", () => {
		mkdirSync(dirname(statePath(runs)), { recursive: true });
		writeFileSync(statePath(runs), JSON.stringify({
			pid: process.pid,
			port
		}));
	});
	server.listen(port, "127.0.0.1");
	setInterval(() => {
		if (Date.now() - last > IDLE_MS) {
			rmSync(statePath(runs), { force: true });
			process.exit(0);
		}
	}, 6e4).unref();
	for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => {
		rmSync(statePath(runs), { force: true });
		process.exit(0);
	});
}
/** Everything the person left on the page, per run: ratings, notes and comments pinned to a spot, with the file each is about. */
async function comments(runs, all) {
	const out = [];
	for (const p of await scanOut(runs)) for (const s of p.sets) {
		const ads = [];
		for (const ad of s.ads) {
			const versions = Object.entries(byVersion(s.feedback.ads[ad.format], s.maxRound)).map(([n, v]) => {
				const round = ad.rounds.find((r) => r.n === Number(n));
				return {
					version: Number(n),
					...v.rating && { rating: v.rating },
					...v.note && { note: v.note },
					...v.pins?.length && { comments_on_the_image: v.pins.map((pin) => ({
						text: pin.text,
						from_left: `${Math.round(pin.x * 100)}%`,
						from_top: `${Math.round(pin.y * 100)}%`
					})) },
					...round && {
						image: join(runs, round.image),
						html: join(runs, round.image.replace(/ad\.png$/, "ad.html"))
					}
				};
			});
			if (versions.length) ads.push({
				format: ad.format,
				newest_version: ad.rounds[ad.rounds.length - 1].n,
				versions
			});
		}
		const fb = s.feedback;
		if (!all && !ads.length && !fb.set_note && !fb.set_rating) continue;
		out.push({
			brand: p.name,
			set: join(runs, s.id),
			...fb.updated && { updated: fb.updated },
			...fb.set_rating && { run_rating: fb.set_rating },
			...fb.set_note && { run_note: fb.set_note },
			ads
		});
	}
	return {
		ratings: {
			star: "Locked. Keep this version as it is.",
			up: "Good direction. Build on this version.",
			down: "Wrong direction, or disliked. Move away from it."
		},
		runs: out
	};
}
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
	const i = rest.indexOf(name);
	return i >= 0 ? rest[i + 1] : void 0;
};
const folder = rest.find((a, i) => !a.startsWith("--") && rest[i - 1] !== "--port");
const runs = folder ? resolve(folder) : "";
const print = (o) => console.log(JSON.stringify(o, null, 1));
if (!cmd || !runs || ![
	"start",
	"stop",
	"comments",
	"serve"
].includes(cmd)) {
	console.error("usage: node page.mjs start|stop|comments <runs folder> [--port 5290] [--no-open] [--all]");
	process.exit(2);
}
if (cmd !== "stop" && !existsSync(runs)) {
	console.error(`No such folder: ${runs}`);
	process.exit(2);
}
if (cmd === "serve") serve(runs, Number(flag("--port")) || 5290);
else if (cmd === "comments") print(await comments(runs, rest.includes("--all")));
else if (cmd === "stop") {
	const s = readState(runs);
	if (s && alive(s.pid) && await answers(s.port, runs)) process.kill(s.pid);
	rmSync(statePath(runs), { force: true });
	print({ stopped: !!s });
} else {
	let s = readState(runs);
	const running = !!s && alive(s.pid) && await answers(s.port, runs);
	if (!running) {
		rmSync(statePath(runs), { force: true });
		spawn(process.execPath, [
			SELF,
			"serve",
			runs,
			"--port",
			flag("--port") ?? "5290"
		], {
			detached: true,
			stdio: "ignore"
		}).unref();
		for (let i = 0; i < 50 && !((s = readState(runs)) && await answers(s.port, runs)); i++) await new Promise((r) => setTimeout(r, 100));
		if (!s) {
			console.error("The page did not start. Check that Node 22 or later runs this script.");
			process.exit(1);
		}
	}
	const address = url(s.port);
	if (!rest.includes("--no-open")) {
		if (process.platform === "darwin") execFile("open", [address], () => {});
		else if (process.platform === "win32") execFile("cmd", [
			"/c",
			"start",
			"",
			address
		], () => {});
		else execFile("xdg-open", [address], () => {});
	}
	print({
		address,
		runs,
		already_running: running,
		opened_in_browser: !rest.includes("--no-open"),
		stops: "by itself after an hour without a visit"
	});
}
export {};

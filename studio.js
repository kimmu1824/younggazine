// 영거진 스튜디오 — 서브컴에서 띄우는 작업 화면 (추가 설치 없음)
// 실행: npm run studio  (또는 start-studio.bat 더블클릭)
// 접속: 서브컴 http://localhost:3939 / 같은 와이파이의 폰 http://<서브컴IP>:3939
//
// 화면: 게시물 목록 → 미리보기 · 사진 전체 저장 · 캡션/해시태그 복사 · ZIP · 다시 렌더 · 디스코드 전송
//       성과 기록(48시간 지표 + 변수별 비교) · 배경 창고
// n8n 등 외부 호출용 API: POST /api/render {"file":"colon-cancer.json","send":true}

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// ---------- .env ----------
(function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

const PORT = Number(process.env.STUDIO_PORT || 3939);
const PIN = process.env.STUDIO_PIN || ""; // 설정하면 접속할 때 PIN을 물어봐요 (테일스케일 등 외부 접속 시 권장)
const DIR = {
  content: path.join(ROOT, "content"),
  output: path.join(ROOT, "output"),
  backgrounds: path.join(ROOT, "backgrounds"),
  data: path.join(ROOT, "data"),
  web: path.join(ROOT, "studio"),
};
const METRICS = path.join(DIR.data, "metrics.json");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff",
};

// ---------- helpers ----------
const send = (res, code, body, type = "application/json; charset=utf-8", extra = {}) => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const safeJoin = (base, rel) => {
  const b = path.resolve(base);
  const p = path.resolve(b, rel);
  return p === b || p.startsWith(b + path.sep) ? p : null;
};
const readJSON = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; } };
const readBody = (req) => new Promise((resolve) => {
  let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e6) req.destroy(); });
  req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve(null); } });
});
const plain = (s = "") => String(s).replace(/\*/g, "").replace(/\n/g, " ").trim();
const isDeckFile = (f) => f.endsWith(".json") && /^[A-Za-z0-9._-]+$/.test(f);

function parseCaption(file) {
  const p = path.join(DIR.content, file.replace(/\.json$/, "-caption.txt"));
  if (!fs.existsSync(p)) return { body: "", tags: "", memo: "" };
  const text = fs.readFileSync(p, "utf8");
  const cut = text.search(/\r?\n---\s*\r?\n/);
  const main = cut >= 0 ? text.slice(0, cut) : text;
  const memo = cut >= 0 ? text.slice(cut).replace(/^\s*---\s*/, "").trim() : "";
  const [bodyPart, tagPart = ""] = main.split(/^\s*\[댓글 해시태그\]\s*$/m);
  return { body: bodyPart.replace(/^\s*\[[^\]]*\]\s*\r?\n/, "").trim(), tags: tagPart.trim(), memo };
}

function deckImages(slug) {
  const d = path.join(DIR.output, slug);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => /^\d{2}\.png$/.test(f)).sort()
    .map((f) => ({ url: `/output/${encodeURIComponent(slug)}/${f}?t=${Math.floor(fs.statSync(path.join(d, f)).mtimeMs)}`, name: f }));
}

function deckInfo(file) {
  const deck = readJSON(path.join(DIR.content, file), null);
  if (!deck || !Array.isArray(deck.slides)) return null;
  const slug = deck.slug || file.replace(/\.json$/, "");
  const cover = deck.slides.find((s) => s.type === "cover") || {};
  return {
    file, slug,
    title: plain(cover.title) || slug,
    kicker: plain(cover.kicker),
    category: deck.category || "",
    coverFont: deck.coverFont || "Black Han Sans",
    bodyStyle: deck.bodyStyle || "card",
    background: deck.background || "",
    slides: deck.slides.length,
    images: deckImages(slug),
    hasCaption: fs.existsSync(path.join(DIR.content, file.replace(/\.json$/, "-caption.txt"))),
    updatedAt: fs.statSync(path.join(DIR.content, file)).mtimeMs,
  };
}

function listDecks() {
  if (!fs.existsSync(DIR.content)) return [];
  return fs.readdirSync(DIR.content).filter((f) => isDeckFile(f) && f !== "sample.json").map(deckInfo).filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function listBackgrounds() {
  if (!fs.existsSync(DIR.backgrounds)) return [];
  return fs.readdirSync(DIR.backgrounds).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().map((f) => {
    const txt = path.join(DIR.backgrounds, f.replace(/\.[^.]+$/, ".txt"));
    return {
      name: f, url: `/backgrounds/${encodeURIComponent(f)}`,
      test: /-test\./.test(f),
      prompt: fs.existsSync(txt) ? fs.readFileSync(txt, "utf8").slice(0, 600) : "",
    };
  });
}

// ---------- render job (한 번에 하나) ----------
let busy = false;
let progress = null; // { file, done, total, sending } — 화면이 폴링해서 "3/6장" 표시
function runRender(file, sendDiscord) {
  return new Promise((resolve) => {
    const total = (readJSON(path.join(DIR.content, file), {}).slides || []).length;
    progress = { file, done: 0, total, sending: false, startedAt: Date.now() };
    const args = [path.join(ROOT, "render.js"), `content/${file}`];
    if (!sendDiscord) args.push("--no-send");
    const child = spawn(process.execPath, args, { cwd: ROOT, env: process.env });
    let log = "";
    child.stdout.on("data", (d) => {
      log += d;
      progress.done = (log.match(/^\s*[✓!] /gm) || []).length;
      if (/완료!/.test(log) && sendDiscord) progress.sending = true;
    });
    child.stderr.on("data", (d) => (log += d));
    child.on("close", (code) => { progress = null; resolve({ ok: code === 0, log: log.trim() }); });
  });
}

// ---------- 원고 저장 (덮어쓰기 전 자동 백업) ----------
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
function backup(file) {
  const bak = path.join(DIR.content, ".bak");
  fs.mkdirSync(bak, { recursive: true });
  const t = stamp();
  const cap = file.replace(/\.json$/, "-caption.txt");
  for (const f of [file, cap]) {
    const src = path.join(DIR.content, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(bak, f.replace(/(\.[a-z]+)$/, `.${t}$1`)));
  }
}
function writeCaption(file, { body = "", tags = "" }, memo) {
  const text = `[본문]\n${String(body).trim()}\n\n[댓글 해시태그]\n${String(tags).trim()}\n` + (memo ? `\n---\n${memo}\n` : "");
  fs.writeFileSync(path.join(DIR.content, file.replace(/\.json$/, "-caption.txt")), text);
}
function validDeck(j) {
  return j && typeof j === "object" && Array.isArray(j.slides) && j.slides.length > 0 && j.slides.length <= 20
    && j.slides.every((s) => s && typeof s === "object" && typeof s.type === "string");
}

// ---------- 배경 추천 ----------
// 원고(한국어) 단어 → 배경 파일명·프롬프트(영어) 단어
const KO_EN = {
  "비": "rain", "장마": "rain", "우산": "umbrella rain", "마라": "mala spicy", "탕": "soup bowl", "음식": "food",
  "커피": "coffee", "카페": "cafe coffee", "회사": "office", "직장": "office", "출근": "commute office subway", "퇴근": "commute night",
  "지하철": "subway", "여름": "summer", "겨울": "winter snow", "눈": "snow", "바다": "beach sea", "여행": "travel",
  "술": "drink beer soju", "맥주": "beer", "돈": "money", "월급": "money salary", "팝업": "popup store", "쇼핑": "shopping",
  "운동": "gym fitness", "다이어트": "diet", "병원": "hospital health", "건강": "health", "암": "health", "잠": "sleep bed",
  "수면": "sleep", "폰": "phone", "스마트폰": "phone", "게임": "game", "매운": "spicy chili", "고추": "chili spicy",
  "라면": "ramen noodle", "치킨": "chicken", "빵": "bread bakery", "디저트": "dessert", "거리": "street", "도시": "city street",
  "밤": "night", "우울": "gloomy moody", "두통": "headache", "날씨": "weather", "횡단보도": "crosswalk street",
};
const words = (s) => String(s || "").toLowerCase().split(/[^a-z0-9가-힣]+/).filter((w) => w.length > 1 || /[가-힣]/.test(w));
function suggestBackgrounds(file) {
  const deck = readJSON(path.join(DIR.content, file), null);
  if (!deck) return [];
  const textAll = JSON.stringify(deck.slides || []) + " " + (deck.category || "");
  const terms = new Set(words(deck.slug || file.replace(/\.json$/, "")));
  for (const [ko, en] of Object.entries(KO_EN)) {
    // 한 글자 단어는 뒤에 조사만 올 때 인정 ("비가 오면" O, "비율" X)
    // 앞에도 한글이 붙으면 안 됨("대비" X) — 단, 암·탕은 "대장암·마라탕"처럼 뒤에 붙는 말이라 예외
    const pre = "암탕".includes(ko) ? "" : "(?<![가-힣])";
    const hit = ko.length > 1 ? textAll.includes(ko) : new RegExp(`${pre}${ko}(?![가-힣])|${pre}${ko}[가는도를을이오와에랑만](?![가-힣])`).test(textAll);
    if (hit) en.split(" ").forEach((w) => terms.add(w));
  }
  ["deck", "json", "b"].forEach((w) => terms.delete(w));
  const seen = new Map(); // 같은 크기 파일 = 복사본 → 하나만
  for (const b of listBackgrounds()) {
    const size = fs.statSync(path.join(DIR.backgrounds, b.name)).size;
    const prev = seen.get(size);
    if (!prev) seen.set(size, b);
    else {
      const keep = prev.test && !b.test ? b : prev, other = keep === b ? prev : b;
      seen.set(size, { ...keep, prompt: keep.prompt || other.prompt, aliases: [...(prev.aliases || []), other.name] });
    }
  }
  return [...seen.values()].map((b) => {
    const nameW = new Set(words(b.name.replace(/\.[^.]+$/, "")));
    const promptW = new Set(words(b.prompt));
    let score = 0; const hits = [];
    for (const t of terms) {
      if (nameW.has(t)) { score += 3; hits.push(t); } else if (promptW.has(t)) { score += 1; hits.push(t); }
    }
    if (b.test) score -= 2; // 시험본(저품질)보다 완성본 우선
    const current = [b.name, ...(b.aliases || [])].some((n) => deck.background === `backgrounds/${n}`);
    if (current) score -= 100; // 지금 쓰는 건 빼고
    return { ...b, score, hits };
  }).filter((b) => b.score >= 2).sort((a, b) => (a.test - b.test) || (b.score - a.score)).slice(0, 3); // 완성본 먼저
}

// ---------- 업로드 표시 + 리마인드 (n8n이 시간 맞춰 호출) ----------
const POSTS = path.join(DIR.data, "posts.json");
const readPosts = () => readJSON(POSTS, []);
const writePosts = (all) => { fs.mkdirSync(DIR.data, { recursive: true }); fs.writeFileSync(POSTS, JSON.stringify(all, null, 2)); };
const H48 = 48 * 3600 * 1000;
function reminders() {
  const decks = listDecks(), metrics = readJSON(METRICS, []), posts = readPosts();
  const hasMetric = (slug) => metrics.some((m) => m.slug === slug && m.reach != null);
  const postOf = (slug) => posts.find((p) => p.slug === slug);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const lastRender = (d) => Math.max(0, ...d.images.map((im) => Number(new URL(im.url, "http://x").searchParams.get("t")) || 0));
  const pick = (d) => ({ slug: d.slug, file: d.file, title: d.title });
  return {
    // 오늘 렌더했는데 아직 '업로드 했어요'를 안 누른 것
    renderedNotPosted: decks.filter((d) => d.images.length && lastRender(d) >= startOfToday.getTime() && !postOf(d.slug)).map(pick),
    // 올린 지 48시간이 지났는데 성과(도달)를 안 넣은 것
    due: decks.filter((d) => { const p = postOf(d.slug); return p && Date.now() - Date.parse(p.postedAt) >= H48 && !hasMetric(d.slug); })
      .map((d) => ({ ...pick(d), postedAt: postOf(d.slug).postedAt, reminded48: !!postOf(d.slug).reminded48 })),
  };
}
async function discordSay(content) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error(".env 에 DISCORD_WEBHOOK_URL 이 없어요");
  const r = await fetch(`${url}?wait=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: content.slice(0, 2000) }) });
  if (!r.ok) throw new Error(`디스코드 전송 실패 (${r.status})`);
}
function remindMessage(kind) {
  const r = reminders();
  const link = process.env.STUDIO_PUBLIC_URL ? `\n👉 ${process.env.STUDIO_PUBLIC_URL}` : "";
  const lines = [];
  if (kind === "daily") {
    if (r.renderedNotPosted.length) lines.push("📤 **오늘 렌더한 게시물** — 올렸으면 스튜디오에서 '업로드 했어요'를 눌러주세요", ...r.renderedNotPosted.map((d) => `• ${d.title}`));
    if (r.due.length) lines.push("📈 **성과 입력할 차례** (올린 지 48시간 지남)", ...r.due.map((d) => `• ${d.title}`));
    return { text: lines.length ? lines.join("\n") + link : "", marks: [] };
  }
  // 48h: 막 48시간이 지난 것만 한 번씩
  const fresh = r.due.filter((d) => !d.reminded48);
  if (fresh.length) lines.push("⏰ **48시간 지났어요 — 인스타 인사이트 숫자 넣을 시간!**", ...fresh.map((d) => `• ${d.title}`));
  return { text: lines.length ? lines.join("\n") + link : "", marks: fresh.map((d) => d.slug) };
}

// ---------- 배경 생성 (유료) — 하루 상한 ----------
const BG_LIMIT = Number(process.env.BG_DAILY_LIMIT || 5);
const USAGE = path.join(DIR.data, "bg-usage.json");
const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (현지 시간)
const bgUsage = () => { const u = readJSON(USAGE, {}); return { date: today(), used: u.date === today() ? u.count || 0 : 0, limit: BG_LIMIT }; };
let bgBusy = false;
function listPrompts() {
  const d = path.join(ROOT, "prompts");
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => /^[A-Za-z0-9._-]+\.txt$/.test(f)).sort()
    .map((f) => ({ name: f.replace(/\.txt$/, ""), text: fs.readFileSync(path.join(d, f), "utf8").slice(0, 4000) }));
}
function runGenBg(promptFile, name, quality) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, "gen-bg.js"), promptFile, name, quality], { cwd: ROOT, env: process.env });
    let log = "";
    const timer = setTimeout(() => { child.kill(); log += "\n시간 초과(3분)"; }, 180000);
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    // 오류 메시지에 키 일부가 섞여 나와도 화면에 안 보이게 가림
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, log: log.replace(/sk-[A-Za-z0-9_*.-]+/g, "sk-***").trim() }); });
  });
}

// ---------- zip (무압축, 의존성 없음) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function makeZip(files) {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"), crc = crc32(f.data), size = f.data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18); lh.writeUInt32LE(size, 22); lh.writeUInt16LE(name.length, 26);
    parts.push(lh, name, f.data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(size, 20); ch.writeUInt32LE(size, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + size;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

// ---------- PIN ----------
const cookieOf = (req, k) => (req.headers.cookie || "").split(/;\s*/).map((c) => c.split("=")).find(([a]) => a === k)?.[1];
// 브라우저는 쿠키, n8n 같은 프로그램은 X-Studio-Pin 헤더로
const authed = (req) => !PIN || decodeURIComponent(cookieOf(req, "yg_pin") || "") === PIN || req.headers["x-studio-pin"] === PIN;

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);

    if (p === "/api/login" && req.method === "POST") {
      const b = await readBody(req);
      if (PIN && b && String(b.pin) === PIN) {
        return send(res, 200, { ok: true }, undefined, { "Set-Cookie": `yg_pin=${encodeURIComponent(PIN)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly` });
      }
      return send(res, 401, { ok: false });
    }
    // 화면 파일은 PIN 없이도 받되(로그인 화면 표시용), 데이터·이미지는 PIN 필요
    const isShell = p === "/" || p.startsWith("/studio/") || p.startsWith("/fonts/") || p.startsWith("/logo/");
    if (!isShell && !authed(req)) return send(res, 401, { error: "pin" });

    // ----- API -----
    if (p === "/api/info") return send(res, 200, { pin: !!PIN, busy, progress, bgBusy, discord: !!process.env.DISCORD_WEBHOOK_URL, openai: !!process.env.OPENAI_API_KEY, bg: bgUsage() });
    if (p === "/api/decks") return send(res, 200, listDecks());
    if (p.startsWith("/api/deck/")) {
      const [file, action = ""] = p.slice("/api/deck/".length).split("/");
      const fp = path.join(DIR.content, file);
      if (!isDeckFile(file) || !fs.existsSync(fp)) return send(res, 404, { error: "없는 원고" });

      if (!action && req.method === "GET") return send(res, 200, { ...deckInfo(file), caption: parseCaption(file), json: readJSON(fp, {}) });

      // 원고·캡션 저장: { json?, caption?: {body, tags} } — 저장 전 content/.bak/ 에 백업
      if (action === "save" && req.method === "POST") {
        const b = await readBody(req);
        if (!b || (!b.json && !b.caption)) return send(res, 400, { error: "json 또는 caption 이 필요해요" });
        if (b.json && !validDeck(b.json)) return send(res, 400, { error: "원고 형식이 이상해요 (slides 배열, 장마다 type 필요)" });
        if (busy) return send(res, 409, { error: "렌더링 중에는 저장할 수 없어요" });
        backup(file);
        if (b.json) {
          const old = readJSON(fp, {});
          const next = { ...b.json, slug: old.slug || file.replace(/\.json$/, "") }; // 결과 폴더가 바뀌지 않게 slug 고정
          fs.writeFileSync(fp, JSON.stringify(next, null, 2) + "\n");
        }
        if (b.caption) writeCaption(file, b.caption, parseCaption(file).memo);
        return send(res, 200, { ok: true, deck: deckInfo(file) });
      }
      // 배경 지정: { background: "rain-01.png" } (빈 값이면 기본 배경)
      if (action === "background" && req.method === "POST") {
        const b = await readBody(req);
        const name = String((b && b.background) || "").replace(/^backgrounds\//, "");
        if (name && (!/^[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(name) || !fs.existsSync(path.join(DIR.backgrounds, name)))) return send(res, 400, { error: "없는 배경이에요" });
        if (busy) return send(res, 409, { error: "렌더링 중에는 바꿀 수 없어요" });
        backup(file);
        const j = readJSON(fp, {});
        j.background = name ? `backgrounds/${name}` : null;
        fs.writeFileSync(fp, JSON.stringify(j, null, 2) + "\n");
        return send(res, 200, { ok: true, background: j.background });
      }
      if (action === "bg-suggest") return send(res, 200, suggestBackgrounds(file));
      // 업로드 표시: { posted: true, postedAt? } / { posted: false } 로 취소
      if (action === "posted" && req.method === "POST") {
        const b = (await readBody(req)) || {};
        const slug = deckInfo(file).slug;
        const all = readPosts().filter((x) => x.slug !== slug);
        let rec = null;
        if (b.posted !== false) {
          const t = b.postedAt && !isNaN(Date.parse(b.postedAt)) ? new Date(b.postedAt).toISOString() : new Date().toISOString();
          rec = { slug, postedAt: t, reminded48: false };
          all.push(rec);
        }
        writePosts(all);
        return send(res, 200, { ok: true, post: rec });
      }
      return send(res, 404, { error: "not found" });
    }
    if (p === "/api/posts") return send(res, 200, readPosts());
    if (p === "/api/reminders") return send(res, 200, reminders());
    // n8n 호출용: POST /api/remind {"kind":"daily"|"48h","dry":false} — 보낼 게 있을 때만 디스코드로
    if (p === "/api/remind" && req.method === "POST") {
      const b = (await readBody(req)) || {};
      const kind = b.kind === "48h" ? "48h" : "daily";
      const { text, marks } = remindMessage(kind);
      if (!text) return send(res, 200, { sent: false, reason: "보낼 알림 없음" });
      if (b.dry) return send(res, 200, { sent: false, dry: true, text });
      await discordSay(text);
      if (marks.length) writePosts(readPosts().map((x) => (marks.includes(x.slug) ? { ...x, reminded48: true } : x)));
      return send(res, 200, { sent: true, text });
    }
    if (p === "/api/prompts") return send(res, 200, listPrompts());
    if (p === "/api/bg/generate" && req.method === "POST") {
      // { name, quality: low|medium|high, promptName?: "rain-street", prompt?: "새 프롬프트(영어)", confirm }
      const b = await readBody(req);
      if (!b) return send(res, 400, { error: "잘못된 요청" });
      const name = String(b.name || "").trim();
      const quality = ["low", "medium", "high"].includes(b.quality) ? b.quality : "low";
      if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(name)) return send(res, 400, { error: "이름은 영어 소문자·숫자·하이픈 2~41자 (예: rain-02)" });
      if (quality !== "low" && b.confirm !== true) return send(res, 400, { error: `${quality} 품질은 비용이 더 들어서 확인(confirm)이 필요해요` });
      if (!process.env.OPENAI_API_KEY) return send(res, 400, { error: ".env 에 OPENAI_API_KEY 가 없어요" });
      if (fs.existsSync(path.join(DIR.backgrounds, `${name}.png`))) return send(res, 409, { error: `이미 있는 이름이에요: ${name}.png (재사용하세요 — 크레딧 절약)` });
      const u = bgUsage();
      if (u.used >= u.limit) return send(res, 429, { error: `오늘 생성 한도(${u.limit}장)를 다 썼어요. .env 의 BG_DAILY_LIMIT 로 바꿀 수 있어요` });
      if (bgBusy) return send(res, 409, { error: "다른 배경을 만드는 중이에요" });

      let promptFile;
      if (b.prompt && String(b.prompt).trim()) {
        const text = String(b.prompt).trim().slice(0, 4000);
        const pf = path.join(ROOT, "prompts", `${name}.txt`);
        if (fs.existsSync(pf) && fs.readFileSync(pf, "utf8").trim() !== text) return send(res, 409, { error: `prompts/${name}.txt 가 이미 있고 내용이 달라요. 이름을 바꿔주세요` });
        fs.mkdirSync(path.dirname(pf), { recursive: true });
        fs.writeFileSync(pf, text + "\n");
        promptFile = `prompts/${name}.txt`;
      } else {
        const pn = String(b.promptName || "");
        if (!/^[A-Za-z0-9._-]+$/.test(pn) || !fs.existsSync(path.join(ROOT, "prompts", `${pn}.txt`))) return send(res, 400, { error: "프롬프트를 고르거나 새로 써주세요" });
        promptFile = `prompts/${pn}.txt`;
      }
      bgBusy = true;
      try {
        const r = await runGenBg(promptFile, name, quality);
        const made = fs.existsSync(path.join(DIR.backgrounds, `${name}.png`));
        if (made) {
          fs.mkdirSync(DIR.data, { recursive: true });
          fs.writeFileSync(USAGE, JSON.stringify({ date: today(), count: bgUsage().used + 1 }));
        }
        return send(res, made ? 200 : 500, { ...r, ok: made, name: `${name}.png`, usage: bgUsage() });
      } finally { bgBusy = false; }
    }
    if (p === "/api/render" && req.method === "POST") {
      const b = await readBody(req);
      const file = b && b.file;
      if (!file || !isDeckFile(file) || !fs.existsSync(path.join(DIR.content, file))) return send(res, 400, { error: "file 값이 필요해요 (예: colon-cancer.json)" });
      if (busy) return send(res, 409, { error: "다른 렌더링이 진행 중이에요" });
      busy = true;
      try { const r = await runRender(file, !!b.send); return send(res, r.ok ? 200 : 500, { ...r, deck: deckInfo(file) }); }
      finally { busy = false; }
    }
    if (p.startsWith("/api/zip/")) {
      const slug = p.slice("/api/zip/".length);
      const d = safeJoin(DIR.output, slug);
      if (!d || !fs.existsSync(d)) return send(res, 404, { error: "렌더된 이미지가 없어요" });
      const files = fs.readdirSync(d).filter((f) => /^\d{2}\.png$/.test(f)).sort()
        .map((f) => ({ name: `${slug}-${f}`, data: fs.readFileSync(path.join(d, f)) }));
      return send(res, 200, makeZip(files), "application/zip", { "Content-Disposition": `attachment; filename="${slug}.zip"` });
    }
    if (p === "/api/backgrounds") return send(res, 200, listBackgrounds());
    if (p === "/api/metrics" && req.method === "GET") return send(res, 200, readJSON(METRICS, []));
    if (p === "/api/metrics" && req.method === "POST") {
      const b = await readBody(req);
      if (!b || !b.slug) return send(res, 400, { error: "slug 필요" });
      const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
      const rec = {
        slug: String(b.slug), postedAt: b.postedAt || "", measuredAt: new Date().toISOString(),
        reach: num(b.reach), saves: num(b.saves), shares: num(b.shares), likes: num(b.likes),
        comments: num(b.comments), follows: num(b.follows), profileVisits: num(b.profileVisits),
        music: !!b.music, commentTags: !!b.commentTags, note: String(b.note || "").slice(0, 300),
      };
      const all = readJSON(METRICS, []).filter((r) => r.slug !== rec.slug);
      all.push(rec);
      fs.mkdirSync(DIR.data, { recursive: true });
      fs.writeFileSync(METRICS, JSON.stringify(all, null, 2));
      return send(res, 200, rec);
    }

    // ----- 정적 파일 -----
    let file = null;
    if (p === "/") file = path.join(DIR.web, "index.html");
    else if (p.startsWith("/studio/")) file = safeJoin(DIR.web, p.slice(8));
    else if (p.startsWith("/output/")) file = safeJoin(DIR.output, p.slice(8));
    else if (p.startsWith("/backgrounds/")) file = safeJoin(DIR.backgrounds, p.slice(13));
    else if (p.startsWith("/fonts/")) file = safeJoin(path.join(ROOT, "fonts"), p.slice(7));
    else if (p.startsWith("/logo/")) file = safeJoin(path.join(ROOT, "logo"), p.slice(6));
    if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return send(res, 200, fs.readFileSync(file), MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
    }
    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`포트 ${PORT}을 이미 쓰고 있어요 — 스튜디오가 이미 켜져 있을 수 있어요.`);
    process.exit(2); // studio-loop.bat 이 2를 보면 길게 쉬었다가 다시 시도
  }
  throw e;
});

server.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log("\n영거진 스튜디오가 켜졌어요 ✨");
  console.log(`  이 컴퓨터:     http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  같은 와이파이: http://${ip}:${PORT}`);
  console.log(PIN ? "  PIN 잠금: 켜짐" : "  PIN 잠금: 꺼짐 (.env 에 STUDIO_PIN=숫자 를 넣으면 켜져요)");
  console.log("\n끄려면 이 창을 닫거나 Ctrl + C\n");
});

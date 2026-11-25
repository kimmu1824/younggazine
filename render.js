// 영거진 카드뉴스 렌더러
// 사용법: node render.js content/sample.json
// 결과:   output/<slug>/01.png, 02.png ...

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// .env 읽기 (DISCORD_WEBHOOK_URL 등)
(function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

// 비율별 크기 (인스타 기준)
const SIZES = {
  "4:5": [1080, 1350],
  "3:4": [1080, 1440],
  "1:1": [1080, 1080],
  "9:16": [1080, 1920],
};

// 브랜드(계정)별 계정명·로고·포인트 색 — brands/<이름>.json, 원고의 "brand"로 고름 (기본 younggazine)
function loadBrand(name) {
  const safe = /^[A-Za-z0-9_-]+$/.test(name || "") ? name : "younggazine";
  const p = path.join(ROOT, "brands", `${safe}.json`);
  if (!fs.existsSync(p)) {
    if (safe !== "younggazine") console.warn(`  ! brands/${safe}.json 이 없어 영거진 브랜드로 렌더해요`);
    return { handle: "@young.gazine", logo: "templates/logo.svg", defaultAccent: "#FFD84D", accents: {} };
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
let BRAND, ACCENTS, DEFAULT_ACCENT, HANDLE, LOGO;
// 글꼴: 본문은 Pretendard, 표지 제목은 아래 중 하나 (원고 JSON의 "coverFont")
// 전부 무료 상업용 가능(OFL) — 라이선스 파일은 fonts/ 폴더에 있어요
const COVER_FONTS = {
  "Black Han Sans": "black-han-sans.woff", // 묵직한 뉴스·썸네일 느낌 (기본)
  "Jua": "jua.woff",                       // 둥글고 귀여운 느낌
  "Do Hyeon": "do-hyeon.woff",             // 길쭉하고 깔끔한 느낌
  "Gasoek One": "gasoek-one.woff",         // 아주 두껍고 튀는 느낌
};
const DEFAULT_COVER_FONT = "Black Han Sans";

function fontFaces() {
  const dataUri = (file, type) =>
    `url(data:font/${type};base64,${fs.readFileSync(path.join(ROOT, "fonts", file)).toString("base64")}) format("${type}")`;
  const pretendard = [["SemiBold", 600], ["Bold", 700], ["ExtraBold", 800], ["Black", 900]]
    .map(([w, n]) => `@font-face{font-family:"Pretendard";font-weight:${n};src:${dataUri(`Pretendard-${w}.woff2`, "woff2")};}`);
  const covers = Object.entries(COVER_FONTS)
    .map(([name, file]) => `@font-face{font-family:"${name}";font-weight:400;src:${dataUri(file, "woff")};}`);
  return [...pretendard, ...covers].join("\n");
}

// 로고: 브랜드 파일의 logo (영거진은 templates/logo.svg)

// 글자 처리: HTML 이스케이프 → *강조* → 줄바꿈
function fmt(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

function imageToDataUri(relPath) {
  const p = path.resolve(ROOT, relPath);
  if (!fs.existsSync(p)) {
    console.warn(`  ! 배경 이미지를 찾을 수 없어 기본 배경을 씁니다: ${relPath}`);
    return null;
  }
  const ext = path.extname(p).slice(1).toLowerCase().replace("jpg", "jpeg");
  return `data:image/${ext};base64,${fs.readFileSync(p).toString("base64")}`;
}

function coverMarkup(s, bgUri) {
  const bg = bgUri
    ? `<div class="bg" style="background-image:url('${bgUri}')"></div><div class="shade"></div>`
    : `<div class="bg fallback"></div><div class="shade"></div>`;
  return `
  <div class="slide cover">
    ${bg}
    ${s.credit ? `<div class="credit">${fmt(s.credit)}</div>` : ""}
    <div class="logo">${LOGO}</div>
    <div class="bottom">
      ${s.kicker ? `<p class="kicker">${fmt(s.kicker)}</p>` : ""}
      <h1${s.titleSize ? ` style="font-size:${Number(s.titleSize)}px"` : ""}>${fmt(s.title)}</h1>
      ${s.sub ? `<p class="sub">${fmt(s.sub)}</p>` : ""}
    </div>
  </div>`;
}

// 사진 배경 본문: style = "glass"(흰 반투명 박스) | "dark"(어둡게 + 흰 글씨)
function photoBodyMarkup(s, idx, total, style, bgUri) {
  const bg = bgUri
    ? `<div class="bg" style="background-image:url('${bgUri}')${s.blur != null ? `;--blur:${Number(s.blur)}px` : ""}"></div>`
    : `<div class="bg fallback"></div>`;
  return `
  <div class="slide pbody ${style}">
    ${bg}<div class="dim"></div>
    <div class="logo">${LOGO}</div>
    <div class="panel">
      ${s.emoji ? `<div class="emoji">${s.emoji}</div>` : ""}
      ${s._inner ? s._inner : `
      ${s.heading ? `<h2>${fmt(s.heading)}</h2>` : ""}
      <p class="text">${fmt(s.text)}</p>
      ${s.note ? `<div class="note">${fmt(s.note)}</div>` : ""}`}
    </div>
    <div class="handle">${HANDLE}</div>
    <div class="page">${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>
  </div>`;
}

// 비교 인포그래픽: columns 2개 × rows 여러 개, 각 값은 0~5 막대 + 짧은 꼬리표
function compareMarkup(s, idx, total, style, bgUri) {
  const st = style === "dark" ? "dark" : "glass";
  const cols = s.columns || [];
  const head = `<div class="cmp-head"><div></div>${cols
    .map((c) => `<div class="cmp-col"><div class="ic">${c.icon || ""}</div><div class="lb">${fmt(c.label)}</div></div>`)
    .join("")}</div>`;
  const rows = (s.rows || []).map((r) => {
    const cells = (r.values || []).map((v, ci) => {
      const level = Math.max(0, Math.min(5, Number(v) || 0));
      const bars = Array.from({ length: 5 }, (_, k) => `<i class="${k < level ? "on" : ""}"></i>`).join("");
      const hi = (r.highlight === ci) ? " hi" : "";
      const tag = r.tags && r.tags[ci] ? `<div class="tag">${fmt(r.tags[ci])}</div>` : "";
      return `<div class="cmp-cell"><div class="bars${hi}">${bars}</div>${tag}</div>`;
    }).join("");
    return `<div class="cmp-row"><div><div class="cmp-name">${fmt(r.name)}</div>${r.desc ? `<div class="cmp-desc">${fmt(r.desc)}</div>` : ""}</div>${cells}</div>`;
  }).join("");
  const inner = `
      ${s.heading ? `<h2>${fmt(s.heading)}</h2>` : ""}
      <div class="cmp">${head}${rows}</div>
      ${s.summary ? `<p class="cmp-sum">${fmt(s.summary)}</p>` : ""}
      ${s.footnote ? `<p class="cmp-foot">${fmt(s.footnote)}</p>` : ""}`;
  return photoBodyMarkup({ ...s, _inner: inner }, idx, total, st, bgUri);
}

// 추세 그래프: stages(가로축 단계) × series(0~5 값의 선) — 개념도용
function trendMarkup(s, idx, total, style, bgUri) {
  const st = style === "dark" ? "dark" : "glass";
  const stages = s.stages || [];
  const W = 800, top = 30, bottom = 300, left = 70, right = 640;
  const xs = stages.map((_, i) => left + (stages.length > 1 ? (i * (right - left)) / (stages.length - 1) : 0));
  const y = (v) => bottom - (Math.max(0, Math.min(5, Number(v) || 0)) / 5) * (bottom - top);
  const grid = [0, 1, 2, 3, 4, 5].map((v) => `<line class="grid" x1="${left - 30}" x2="${right + 30}" y1="${y(v)}" y2="${y(v)}"/>`).join("");
  const series = (s.series || []).map((se) => {
    const c = se.color === "accent" ? "accent" : "ink";
    const pts = (se.values || []).map((v, i) => [xs[i], y(v)]);
    const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
    const dots = pts.map(([px, py]) => `<circle class="dot ${c}" cx="${px}" cy="${py}" r="15"/>`).join("");
    const [lx, ly] = pts[pts.length - 1] || [0, 0];
    return `<path class="ln ${c}" d="${d}"/>${dots}<text class="lbl ${c}" x="${lx + 32}" y="${ly + 11}">${fmt(se.name)}</text>`;
  }).join("");
  const axis = stages.map((sg, i) =>
    `<text class="icon" x="${xs[i]}" y="${bottom + 86}" text-anchor="middle">${sg.icon || ""}</text>` +
    `<text class="stage" x="${xs[i]}" y="${bottom + 132}" text-anchor="middle">${fmt(sg.label)}</text>`).join("");
  const inner = `
      ${s.heading ? `<h2>${fmt(s.heading)}</h2>` : ""}
      <div class="trend"><svg viewBox="0 0 ${W} ${bottom + 150}">${grid}${series}${axis}</svg></div>
      ${s.summary ? `<p class="cmp-sum">${fmt(s.summary)}</p>` : ""}
      ${s.note ? `<div class="note">${fmt(s.note)}</div>` : ""}
      ${s.footnote ? `<p class="cmp-foot">${fmt(s.footnote)}</p>` : ""}`;
  return photoBodyMarkup({ ...s, _inner: inner }, idx, total, st, bgUri);
}

// 실제 통계: 큰 숫자 + 그룹별 가로 막대 (막대 길이 = 실제 값 비례)
function statMarkup(s, idx, total, style, bgUri) {
  const st = style === "dark" ? "dark" : "glass";
  const bars = s.bars || [];
  const max = Math.max(...bars.map((b) => Number(b.value) || 0), 1);
  const rows = bars.map((b, i) => `
      <div class="hbar-row${s.highlight === i ? " hi" : ""}">
        <div class="hbar-name">${fmt(b.label)}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${((Number(b.value) || 0) / max) * 100}%"></div></div>
        <div class="hbar-val">${fmt(b.display ?? String(b.value))}</div>
      </div>`).join("");
  const inner = `
      ${s.heading ? `<h2>${fmt(s.heading)}</h2>` : ""}
      ${s.big ? `<div class="stat-big">${fmt(s.big)}${s.bigUnit ? `<span class="unit">${fmt(s.bigUnit)}</span>` : ""}${s.bigArrow ? `<span class="arrow">${s.bigArrow}</span>` : ""}</div>` : ""}
      ${s.bigLabel ? `<p class="stat-label">${fmt(s.bigLabel)}</p>` : ""}
      ${s.sub ? `<p class="stat-sub">${fmt(s.sub)}</p>` : ""}
      ${rows ? `<div class="hbar">${rows}</div>` : ""}
      ${s.source ? `<p class="src">출처: ${fmt(s.source)}</p>` : ""}`;
  return photoBodyMarkup({ ...s, _inner: inner }, idx, total, st, bgUri);
}

// 아이콘 목록: items [{icon, title, desc}] + note / cta
function listMarkup(s, idx, total, style, bgUri) {
  const st = style === "dark" ? "dark" : "glass";
  const items = (s.items || []).map((it) => `
      <div class="lst-item">
        <div class="lst-ic">${it.icon || "•"}</div>
        <div><div class="lst-t">${fmt(it.title)}</div>${it.desc ? `<div class="lst-d">${fmt(it.desc)}</div>` : ""}</div>
      </div>`).join("");
  const inner = `
      ${s.heading ? `<h2>${fmt(s.heading)}</h2>` : ""}
      <div class="lst${s.compact ? " compact" : ""}">${items}</div>
      ${s.note ? `<div class="note">${fmt(s.note)}</div>` : ""}
      ${s.cta ? `<div class="cta">${fmt(s.cta)}</div>` : ""}
      ${s.footnote ? `<p class="cmp-foot">${fmt(s.footnote)}</p>` : ""}`;
  return photoBodyMarkup({ ...s, _inner: inner }, idx, total, st, bgUri);
}

function bodyMarkup(s, idx, total) {
  return `
  <div class="slide body">
    <div class="frame"></div>
    <div class="inner">
      ${s.heading ? `<h2>${fmt(s.heading)}</h2>` : ""}
      <p class="text">${fmt(s.text)}</p>
      ${s.note ? `<div class="note">${fmt(s.note)}</div>` : ""}
    </div>
    ${s.emoji ? `<div class="emoji">${s.emoji}</div>` : ""}
    <div class="logo">${LOGO}</div>
    <div class="handle">${HANDLE}</div>
    <div class="page">${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>
  </div>`;
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) {
    console.log("사용법: node render.js content/파일이름.json");
    process.exit(1);
  }
  const deck = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), "utf8"));
  BRAND = loadBrand(deck.brand);
  ACCENTS = BRAND.accents || {};
  DEFAULT_ACCENT = BRAND.defaultAccent || "#FFD84D";
  HANDLE = BRAND.handle || "";
  LOGO = fs.readFileSync(path.resolve(ROOT, BRAND.logo || "templates/logo.svg"), "utf8");
  const [w, h] = SIZES[deck.ratio || "4:5"] || SIZES["4:5"];
  const accent = deck.accent || ACCENTS[deck.category] || DEFAULT_ACCENT;
  const template = fs.readFileSync(path.join(ROOT, "templates", "card.html"), "utf8");
  const bgUri = deck.background ? imageToDataUri(deck.background) : null;
  const coverFont = COVER_FONTS[deck.coverFont] ? deck.coverFont : DEFAULT_COVER_FONT;
  const faces = fontFaces();

  const slug = deck.slug || path.basename(file, ".json");
  const outDir = path.join(ROOT, "output", slug);
  fs.mkdirSync(outDir, { recursive: true });

  // CHROME_PATH 환경변수가 있으면 그 크롬을 사용 (없으면 playwright 기본 크롬)
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
  const page = await browser.newPage({ viewport: { width: w, height: h } });

  const slides = deck.slides || [];
  const saved = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    // 장마다 배경을 따로 줄 수도 있고(slide.background), 없으면 표지 배경을 그대로 씀
    const slideBg = s.background ? imageToDataUri(s.background) : bgUri;
    // 본문 스타일: 장별 style > 원고 전체 bodyStyle > 기본 card(흰 카드)
    const style = s.style || deck.bodyStyle || "card";
    let markup;
    if (s.type === "cover") markup = coverMarkup(s, slideBg);
    else if (s.type === "compare") markup = compareMarkup(s, i, slides.length, style, slideBg);
    else if (s.type === "trend") markup = trendMarkup(s, i, slides.length, style, slideBg);
    else if (s.type === "stat") markup = statMarkup(s, i, slides.length, style, slideBg);
    else if (s.type === "list") markup = listMarkup(s, i, slides.length, style, slideBg);
    else if (style === "glass" || style === "dark") markup = photoBodyMarkup(s, i, slides.length, style, slideBg);
    else markup = bodyMarkup(s, i, slides.length);
    const html = template
      .replace("{{WIDTH}}", w).replace("{{HEIGHT}}", h)
      .replace("{{ACCENT}}", accent)
      .replace("{{FONTFACES}}", () => faces)
      .replace("{{COVER_FONT}}", coverFont)
      .replace("{{SLIDE}}", () => markup);
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(outDir, `${String(i + 1).padStart(2, "0")}.png`);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
    try {
      fs.writeFileSync(out, png);
      saved.push(out);
      console.log(`  ✓ ${path.relative(ROOT, out)}`);
    } catch (e) {
      // 윈도우에서 사진 뷰어·미리보기 창이 파일을 잡고 있으면 덮어쓰기가 막혀요 → 다른 이름으로 저장
      const alt = out.replace(/\.png$/, `-${Date.now()}.png`);
      fs.writeFileSync(alt, png);
      saved.push(alt);
      console.log(`  ! ${path.basename(out)} 파일이 다른 프로그램에서 열려 있어 새 이름으로 저장: ${path.relative(ROOT, alt)}`);
    }
  }

  await browser.close();
  console.log(`\n완료! ${slides.length}장 → output/${slug}/`);

  // 디스코드로 보내기 (.env 에 DISCORD_WEBHOOK_URL 이 있을 때만, --no-send 로 끌 수 있음)
  if (process.env.DISCORD_WEBHOOK_URL && !process.argv.includes("--no-send")) {
    await sendToDiscord(slug, saved, readCaption(file, deck));
  }
}

// 캡션 파일 구조: content/<원고이름>-caption.txt
//   [본문]          ← 인스타 본문에 붙여넣을 글
//   [댓글 해시태그]  ← 첫 댓글용 해시태그 (따로 메시지로 보냄)
//   ---             ← 이 아래는 메모 (안 보냄)
function readCaption(file, deck) {
  if (deck.caption) return { body: deck.caption, tags: deck.commentTags || "" };
  const p = path.resolve(ROOT, file).replace(/\.json$/, "-caption.txt");
  if (!fs.existsSync(p)) return { body: "", tags: "" };
  const text = fs.readFileSync(p, "utf8").split(/\r?\n---/)[0];
  const [bodyPart, tagPart = ""] = text.split(/^\s*\[댓글 해시태그\]\s*$/m);
  const body = bodyPart.replace(/^\s*\[[^\]]*\]\s*\r?\n/, "").trim(); // 맨 위 [제목] 줄 제거
  return { body, tags: tagPart.trim() };
}

async function sendToDiscord(slug, files, caption) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  const post = async (form) => {
    const res = await fetch(`${url}?wait=true`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`디스코드 전송 실패 (${res.status}) ${await res.text()}`);
  };
  try {
    // 1) 사진 (한 메시지에 최대 10장)
    for (let i = 0; i < files.length; i += 10) {
      const form = new FormData();
      const chunk = files.slice(i, i + 10);
      form.append("payload_json", JSON.stringify({
        content: i === 0 ? `📦 **${slug}** — ${files.length}장 (순서대로 업로드)` : "",
      }));
      chunk.forEach((f, k) => {
        form.append(`files[${k}]`, new Blob([fs.readFileSync(f)], { type: "image/png" }), path.basename(f));
      });
      await post(form);
    }
    // 2) 본문 캡션, 3) 댓글용 해시태그 — 각각 길게 눌러 복사하기 좋게 따로 한 메시지씩
    for (const text of [caption.body, caption.tags]) {
      if (!text) continue;
      const form = new FormData();
      form.append("payload_json", JSON.stringify({ content: text.slice(0, 2000) }));
      await post(form);
    }
    console.log("📨 디스코드로 보냈어요!");
  } catch (e) {
    console.log("! " + e.message + "\n  (PNG 파일은 output 폴더에 정상 저장돼 있어요)");
  }
}

main().catch((e) => {
  console.error("오류:", e.message);
  process.exit(1);
});

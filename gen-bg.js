// GPT 이미지 API로 카드뉴스 배경을 만드는 스크립트 (추가 설치 필요 없음)
// 사용법: node gen-bg.js prompts/rain-street.txt rain-01
// 결과:   backgrounds/rain-01.png
//
// 키는 .env 파일의 OPENAI_API_KEY 에서 읽어요. 채팅에 키를 붙여넣지 마세요.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// .env 읽기 (간단 버전)
function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
// 4:5 비율 (16의 배수). 모델이 이 크기를 거부하면 .env 에 OPENAI_IMAGE_SIZE=1024x1536 으로 바꾸세요.
const SIZE = process.env.OPENAI_IMAGE_SIZE || "1088x1360";
// low / medium / high — 테스트는 low·medium, 최종본만 high 추천
// 실행할 때 세 번째 값으로 바꿀 수도 있어요: node gen-bg.js 프롬프트.txt 이름 low
const QUALITY = process.argv[4] || process.env.OPENAI_IMAGE_QUALITY || "medium";

async function main() {
  const [promptFile, name] = process.argv.slice(2);
  if (!promptFile || !name) {
    console.log("사용법: node gen-bg.js prompts/파일.txt 저장할이름");
    process.exit(1);
  }
  if (!KEY) {
    console.log("오류: .env 파일에 OPENAI_API_KEY 가 없어요. README의 키 설정 부분을 확인하세요.");
    process.exit(1);
  }

  const prompt = fs.readFileSync(path.resolve(ROOT, promptFile), "utf8").trim();
  const out = path.join(ROOT, "backgrounds", `${name}.png`);
  if (fs.existsSync(out)) {
    console.log(`이미 있어요: backgrounds/${name}.png (다시 만들려면 다른 이름을 쓰세요 — 크레딧 절약)`);
    process.exit(0);
  }

  console.log(`생성 중... (모델 ${MODEL}, 크기 ${SIZE}, 품질 ${QUALITY}) 30초~1분 걸릴 수 있어요`);
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.log("API 오류:", data?.error?.message || res.status);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(data.data[0].b64_json, "base64"));
  // 어떤 프롬프트로 만들었는지 같이 기록 (재사용할 때 참고)
  fs.writeFileSync(out.replace(/\.png$/, ".txt"), `model: ${MODEL}\nsize: ${SIZE}\nquality: ${QUALITY}\n\n${prompt}\n`);
  console.log(`완료! backgrounds/${name}.png`);
}

main().catch((e) => {
  console.error("오류:", e.message);
  process.exit(1);
});

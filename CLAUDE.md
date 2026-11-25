# 영거진(younggazine) 프로젝트 안내 — Claude Code용

> 개발 작업을 시작하기 전에 **`DEV_BRIEF.md`(개발 지시서)** 를 먼저 읽고, 거기 적힌 과제 순서와 규칙을 따른다.

인스타 계정 '영거진'(@young.gazine, 늙크크 2030 직장인 대상 커뮤니티형 매거진)의 카드뉴스를 만드는 도구.
사용자는 영환님. 한국어로, 결론부터 짧게 답한다. 윈도우 서브컴(Node.js)에서 실행된다.

## 구조
- `render.js` — 원고 JSON → 카드뉴스 PNG(1080×1350). 끝나면 .env의 DISCORD_WEBHOOK_URL로 사진·본문·댓글 해시태그를 보낸다(`--no-send`로 끔).
  - 장 종류: cover / body / compare / trend / stat / list (README 참고)
- `gen-bg.js` — OpenAI 이미지 API로 글씨 없는 배경 생성 → `backgrounds/`. 같은 이름은 재생성 안 함.
- `templates/card.html` — 디자인(CSS). `templates/logo.svg` — 카드 로고.
- `fonts/` — Pretendard(본문) + 표지 폰트 4종(OFL).
- `content/<slug>.json` + `content/<slug>-caption.txt` — 원고와 캡션([본문] / [댓글 해시태그] / --- 메모). GitHub에 올리지 않음.
- `prompts/` — 배경 프롬프트(영어).

## 명령
```
node gen-bg.js prompts/<이름>.txt <이름>-test low     # 시험 생성(저품질)
npm run render -- content/<slug>.json                  # 렌더 + 디스코드 전송
github-upload.bat                                      # GitHub(kimmu1824/younggazine)에 올리기
npm run studio                                         # 영거진 스튜디오 (http://localhost:3939)
```

## 지켜야 할 규칙
- `.env`(API 키·토큰)는 절대 출력·커밋·전송하지 않는다. 값이 필요하면 키 이름과 빈칸 여부만 확인한다.
- 유료 API(OpenAI 이미지)는 저품질 시험 → 승인 후 고품질 순서. 같은 배경은 재사용.
- 원고 규칙(팩트체크, 인과 단정 금지, 브랜드 비방 금지, 개념도 표기, 해시태그 본문 5개·댓글 30개)은 영거진 카드뉴스 스킬과 같다.
- 음식 배경은 실사 클로즈업 금지(징그럽게 나온 전례). 일러스트나 밝고 깔끔한 화보로.

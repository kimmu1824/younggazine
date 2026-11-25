# 영거진 개발 지시서 (Claude Code용)

> Claude Code에게: 이 문서를 처음부터 끝까지 읽고, **"3. 개발 과제"를 P1부터 순서대로** 진행해. 한 과제가 끝날 때마다 아래 체크박스를 [x]로 바꾸고, 완료 기준대로 직접 테스트한 결과를 한 줄 남겨. 규칙(4장)은 어떤 과제보다 우선한다.

---

## 1. 배경

### 계정
- 인스타그램 **영거진(@young.gazine)**: "늙크크(유행에 뒤처졌다고 느끼는 2030 직장인)"를 위한 커뮤니티형 매거진.
- 진지한 뉴스가 아니라 **피식 웃고 친구에게 공유할 만한 것**이 핵심. 진짜 정보도 섞는다.
- 카테고리: 신조어·유행어 / 밈 / 팝업·이벤트 / 인기템 / 늙크크들은 모르는 사실 / 요즘 애들 썰·뉴스.
- 목표: 공유로 팔로워·노출을 늘려 협찬 광고를 받는 것. 나중에 쿠팡파트너스 계정도 같은 공장으로 운영할 예정.

### 사용자
- 영환님. 퍼포먼스 마케터. 바이브코딩 중급(초보는 아님). 한국어로, **결론부터 짧게** 답한다.
- "수치를 보고 개선하는 것"을 중요하게 여긴다 → 성과 기록·비교 기능이 중요.

### 장비
- **서브컴(이 컴퓨터, Windows, `DESKTOP-KRLMCKO`)**: 부업 전용 실행 컴퓨터. Ryzen 3600 + GTX 1650(4GB, 로컬 AI 생성엔 부적합). 밤에는 꺼도 됨.
- 메인컴(RTX 4060 Ti): 영상 편집용. 서브컴과 PowerToys 경계 없는 마우스로 연결.
- 서브컴에 Node.js, Docker Desktop, **n8n(Docker 컨테이너, 포트 5678, 워크플로 아직 없음)** 설치됨.

---

## 2. 지금까지 결정된 것 (바꾸지 말 것)

| 영역 | 결정 |
|---|---|
| 리서치·원고 작성 | **Claude 채팅(Pro 구독) + 스킬 + 예약 작업**으로 한다. Claude API로 원고를 쓰는 기능은 만들지 않는다. |
| 매일 흐름 | 07:43 예약 작업이 소재 리서치(번호 매김) → 영환님이 "3번 만들어" 답장 → `younggazine-cardnews` 스킬이 팩트체크·원고·렌더·캡션 전달 |
| 유료 API | **OpenAI 이미지(배경)만** 사용. 충전식. 글씨는 절대 AI에게 맡기지 않고 렌더러가 얹는다. |
| 카드 렌더링 | `render.js` (Playwright, HTML/CSS → PNG 1080×1350, 4:5) |
| 폰으로 받기 | **영거진 스튜디오(로컬 웹앱)** 에서 사진 저장·캡션 복사. 디스코드 웹훅은 보조 알림. 디스코드 봇은 만들지 않기로 함. |
| 업로드 | 인스타 업로드는 **사람이 폰에서** 한다 (음악은 앱에서만 가능, 최종 검수 필요). 자동 업로드 기능 금지. |
| n8n | 예약 실행·외부 연동(노션, 인스타 인사이트) 담당. Docker 안에서 돌기 때문에 윈도우 명령을 직접 못 부름 → 스튜디오 API(`http://host.docker.internal:3939`)를 호출한다. |
| GitHub | `kimmu1824/younggazine` (Public). 원고(`content/`)·`.env`·`data/`·`output/`은 올리지 않는다. |

---

## 3. 개발 과제

### P0 — 완료 (2026-11-25 새벽, 채팅 Claude가 구현·테스트함)
- [x] **영거진 스튜디오 v1** (`studio.js`, `studio/index.html`, `start-studio.bat`)
  - 게시물 목록 → 상세(카드 미리보기 넘겨보기, **사진 전체 저장**, **캡션 복사**, **해시태그 복사**, ZIP, 다시 렌더, 디스코드로)
  - 성과 기록(48시간 지표 입력 → `data/metrics.json`, 음악·댓글 해시태그·본문 스타일·표지 폰트·카테고리별 평균 비교)
  - 배경 창고(배경 + 프롬프트 보기, 경로 복사)
  - API: `GET /api/decks`, `GET /api/deck/<file>`, `POST /api/render {file, send}`, `GET /api/zip/<slug>`, `GET/POST /api/metrics`, `GET /api/backgrounds`
  - 선택 PIN 잠금(`.env`의 `STUDIO_PIN`)
  - 테스트: API 전부 호출, 경로 조작 차단 확인, ZIP 무결성 확인, 아이폰 화면 크기 스크린샷 확인. **서브컴(윈도우) 실행은 아직 미확인.**

### P1 — 바로 할 것
- [x] **서브컴에서 스튜디오 실행 확인**: `npm run studio` → `http://localhost:3939` 접속, 렌더 버튼 동작(윈도우 경로·한글 폴더명 `C:\Users\집` 포함) 확인. 문제 있으면 고친다.
  - 완료 기준: 목록·상세·렌더·ZIP·성과 저장이 윈도우에서 동작.
  - ✅ 2026-11-25 테스트: 목록 3개·rain-mood 렌더 6장·ZIP 6장 정상·성과 저장/읽기·`..\` 경로 조작 5종 404·화면 스크린샷 확인. 수정 사항 없음.
- [ ] **GitHub 올리기**: 레포가 없으면 영환님에게 github.com/new 에서 `younggazine`(Public, README 없이) 생성을 요청 → `github-upload.bat` 또는 git으로 push.
  - 완료 기준: `git ls-files`에 `.env`, `content/`(sample.json 제외), `data/`가 **없음**을 확인하고 push.
  - ⏸ 2026-11-25: git 미설치. `winget install Git.Git`이 관리자 권한(UAC) 창을 요구해 무인 설치 불가 → 영환님 작업 대기. `.gitignore`는 .env·content/*(sample 제외, .bak 포함)·data/·output/ 제외 확인.
- [x] **스튜디오 자동 실행**: 서브컴 로그인 시 스튜디오가 자동으로 켜지게 (작업 스케줄러 또는 시작프로그램, 창 최소화). 꺼지면 다시 켜지게.
  - 완료 기준: 재부팅 후 `http://localhost:3939` 접속됨. 끄는 방법도 README에 적기.
  - ✅ 2026-11-25: 시작프로그램 바로가기(최소화) → `studio-loop.bat`(꺼지면 5초 뒤 재시작, 포트 사용 중이면 60초 대기). node 강제 종료 → 5초 뒤 자동 재시작 확인. 켜기/끄기/정지 bat + README. **실제 재부팅 테스트는 아직**(바로가기 실행으로 대신 확인).
- [ ] **폰 접속(테일스케일)**: 영환님이 테일스케일을 서브컴·폰에 설치하면, `tailscale serve`로 스튜디오를 **https 주소**로 열기(폰 "사진 전체 저장"의 공유 시트는 https에서만 동작). `STUDIO_PIN` 설정 권장.
  - 완료 기준: 폰 사파리/크롬에서 https 주소로 접속 → "사진 전체 저장" 한 번에 앨범 저장.
  - ⏸ 2026-11-25: 서브컴은 테일스케일 로그인됨(desktop-krlmcko.tail83def0.ts.net). `tailscale serve` → "Serve is not enabled on your tailnet" → 관리 페이지에서 켜기 필요. 켠 뒤 `tailscale-serve.bat` 실행. 폰은 아직 테일넷에 없음.

### P2 — 제작 편의
- [x] **배경 생성 버튼**: 스튜디오 배경 창고에서 프롬프트 입력/선택 → `gen-bg.js` 실행(low 기본, high는 확인창). **하루 생성 횟수 상한**(`.env`의 `BG_DAILY_LIMIT`, 기본 5) 두기. 결과를 원고의 background로 지정하는 버튼.
  - ✅ 2026-11-25: `POST /api/bg/generate`, `/api/prompts`, `/api/deck/<f>/background`. 테스트(유료 호출 없이): 잘못된 이름·high 확인 없음·기존 이름·경로 조작 거부, 상한 5 도달 시 429, 배경 지정 저장. medium/high는 서버도 confirm 필요. 오류 로그의 `sk-` 키 조각 가림. **실제 생성 1회는 영환님 확인 후**.
- [x] **원고 간단 편집**: 상세 화면에서 장별 텍스트(title/kicker/sub/heading/text/note, list items) 수정 → JSON 저장 → 다시 렌더. 캡션·해시태그도 수정 가능. 저장 전 자동 백업(`content/.bak/`).
  - ✅ 2026-11-25: `POST /api/deck/<f>/save` + 편집 화면(+고급 JSON). 시험 원고로 저장·slug 고정·캡션 메모 유지·백업 2개 생성·잘못된 JSON 거부, 화면에서 수정 → 저장하고 렌더 → 표지에 반영 확인.
- [x] **배경 추천**: 원고 카테고리·키워드와 배경 파일명/프롬프트를 비교해 재사용할 배경 후보 3개 제안.
  - ✅ 2026-11-25: 한→영 단어표 + 파일명(3점)/프롬프트(1점), 복사본(같은 크기) 합치기, 완성본 우선, 현재 배경 제외. colon-cancer → mala-01(일러스트) 1순위, rain-mood → 후보 없음(비 배경은 현재 것뿐) 확인.
- [x] **렌더 진행 표시**: 렌더 중 몇 장째인지 표시(SSE 또는 폴링).
  - ✅ 2026-11-25: `/api/info.progress` 0.7초 폴링 → "렌더링 중 3 / 5장" 막대 확인.

### P3 — 자동화·데이터 (n8n)
- [x] **n8n 워크플로(가져오기용 JSON)**: 매일 21시 "오늘 렌더했지만 성과 기록 안 한 게시물" 알림(디스코드 웹훅), 업로드 48시간 뒤 성과 입력 리마인드.
  - ✅ 2026-11-25: `n8n/younggazine-reminders.json`. 스튜디오에 업로드 표시(`/api/deck/<f>/posted`)·`/api/reminders`·`/api/remind` 추가(웹훅은 스튜디오가 보냄, 48h는 게시물당 1회). dry 테스트로 daily/48h 문구 확인, n8n 컨테이너→`host.docker.internal:3939` 접속 확인, n8n에 **비활성 상태로 가져옴**(ID LA5EsnrV8rHasbd6). 켜기(Active)는 영환님이 n8n 로그인 후.
- [ ] **인스타 인사이트 자동 수집**: 인스타를 크리에이터 계정으로 전환 + 페이스북 페이지 연결이 선행(영환님 작업). 그 뒤 Instagram Graph API로 게시물별 도달·저장·공유를 가져와 `/api/metrics`에 기록. 토큰은 `.env`.
- [ ] **노션 기록(선택)**: 발행 기록·성과를 노션 DB에 동기화(중복 주제 체크용). 영환님은 시트보다 노션을 선호.

### P4 — 확장
- [x] 쿠팡파트너스·스레드 계정용 템플릿/브랜드(로고·색) 프리셋 추가 (같은 렌더러 재사용).
  - ✅ 2026-11-25: `brands/<이름>.json` + 원고 `"brand"`. 기본(영거진) sample 렌더 결과가 변경 전과 해시 동일, 임시 브랜드로 계정명·포인트 색 바뀜 확인. 실제 쿠팡·스레드 프리셋(로고·색)은 정해지면 추가.
- [ ] 릴스용 9:16 세로 영상(카드 슬라이드쇼 + 음악 없는 버전) 내보내기.
  - ⏸ ffmpeg 미설치(mp4 만들려면 필요). 설치 후 진행.

---

## 4. 규칙 (항상 우선)

### 보안·비용
- `.env`(OPENAI_API_KEY, ANTHROPIC_API_KEY, DISCORD_WEBHOOK_URL, DISCORD_BOT_TOKEN 등)는 **절대 출력·로그·커밋·전송 금지**. 확인이 필요하면 키 이름과 빈칸 여부만.
- 유료 API 호출(OpenAI 이미지)은 **저품질 시험 1장 → 영환님 확인 → 고품질** 순서. 반복 호출 루프 금지. 같은 이름 배경은 재생성하지 않는다.
- 파일 삭제가 필요하면 먼저 묻는다. 원고·캡션은 덮어쓰기 전에 백업.
- 스튜디오는 기본적으로 같은 와이파이/테일스케일 안에서만 접근. 인터넷 공개(포트포워딩, funnel) 금지.

### 콘텐츠 (스킬과 동일)
- 실존 인물·기업·브랜드 허위사실·비방 금지. 브랜드명을 질병·사고의 원인처럼 엮지 않기.
- 정치·젠더 논쟁 제외. 숫자는 원문 확인, 인과 단정 금지("원인으로 꼽히는").
- 개념 그래프엔 "개념도(실제 수치 아님)", 실제 통계엔 출처 기관.
- 해시태그: 본문 5개(인스타 제한), 댓글 30개.
- 음식 배경은 실사 클로즈업 금지(주름진 건고추·튀긴 두부 등으로 징그럽게 나온 전례). 일러스트나 밝고 깔끔한 화보로.

### 작업 방식
- 작은 단위로 고치고, 고칠 때마다 `content/sample.json`으로 렌더 테스트.
- 새 기능은 README와 이 문서 체크박스에 반영.
- 영환님이 직접 해야 하는 일(계정 생성, 로그인, 설치 동의)은 한 번에 모아서 짧게 요청.

---

## 5. 파일 지도

| 파일 | 역할 |
|---|---|
| `render.js` | 원고 JSON → PNG. 장 종류 cover/body/compare/trend/stat/list. 끝나면 디스코드 웹훅 전송(`--no-send`로 끔). 파일이 열려 있으면 새 이름으로 저장. |
| `gen-bg.js` | OpenAI 이미지 → `backgrounds/<이름>.png` + 프롬프트 기록 `.txt` |
| `studio.js`, `studio/index.html` | 영거진 스튜디오 (포트 3939) |
| `templates/card.html`, `templates/logo.svg` | 카드 디자인, 로고 |
| `fonts/` | Pretendard + 표지 폰트 4종 (OFL) |
| `content/<slug>.json`, `content/<slug>-caption.txt` | 원고·캡션(`[본문]`, `[댓글 해시태그]`, `---` 아래 메모) |
| `prompts/` | 배경 프롬프트 |
| `data/metrics.json` | 성과 기록 (GitHub 제외) |
| `github-upload.bat`, `start-studio.bat` | 윈도우용 실행 파일 |
| `studio-loop.bat`, `autostart-on/off.bat`, `stop-studio.bat`, `scripts/studio-control.ps1` | 자동 실행·재시작·끄기 (bat은 영어만 — cmd가 UTF-8 한글 줄을 깨뜨림) |
| `tailscale-serve.bat` | 테일넷 안 https 열기 |
| `n8n/younggazine-reminders.json` | n8n 리마인드 워크플로 |
| `brands/` | 브랜드 프리셋 (계정명·로고·색) |
| `data/posts.json`, `data/bg-usage.json`, `data/studio.log` | 업로드 기록, 배경 생성 횟수, 스튜디오 로그 (GitHub 제외) |
| `CLAUDE.md` | Claude Code가 자동으로 읽는 요약 안내 |

## 6. 현재 원고
- `rain-mood` — 비 오는 날 머리 아프고 우울하면 늙었다는 증거? (6장, 배경 rain-crosswalk-01)
- `colon-cancer` — 20·30대 대장암 80% 급증 (4장, 배경 mala-01 = 마라탕 일러스트. 실사 버전은 prompts/mala-clean.txt로 시험 예정)

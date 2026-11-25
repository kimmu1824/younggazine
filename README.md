# 영거진 카드뉴스 공장 — 1단계: 렌더러

JSON 파일 하나만 쓰면 인스타 카드뉴스 PNG가 자동으로 나옵니다. 유료 API는 쓰지 않아요.

## 처음 한 번만 (설치)

1. Node.js LTS 설치: https://nodejs.org
2. 파일 탐색기에서 이 폴더(`younggazine`)를 열고, 주소창에 `cmd` 입력 후 Enter
3. 검은 창에서 차례로 입력:

```
npm install
npm run setup
```

`npm run setup`은 카드를 그릴 크롬을 내려받아요. 몇 분 걸릴 수 있습니다.

## 샘플 만들어 보기

```
npm run sample
```

`output\sample-odyssey\` 폴더에 01.png ~ 05.png가 생기면 성공입니다.

## 내 카드뉴스 만들기

1. `content\sample.json`을 복사해서 이름을 바꿉니다. 예: `content\youth-rent.json`
2. 내용을 수정합니다.
3. 실행:

```
npm run render -- content/youth-rent.json
```

## GPT로 배경 이미지 만들기

1. `.env` 파일에 `OPENAI_API_KEY=` 뒤로 키를 넣어 둡니다.
2. `prompts\` 폴더에 프롬프트(영어, 글씨 없는 배경)를 써 둡니다.
3. 실행:

```
node gen-bg.js prompts/rain-street.txt rain-01
```

`backgrounds\rain-01.png`가 생기고, 같은 이름이 이미 있으면 다시 만들지 않아요(크레딧 절약).
품질·모델·크기는 `.env`의 선택 설정으로 바꿀 수 있어요.

## JSON 쓰는 법

| 항목 | 설명 |
|---|---|
| `slug` | 결과 폴더 이름 (영어·숫자·하이픈) |
| `category` | 포인트 색 결정: 신조어 / 밈 / 팝업 / 인기템 / 몰랐던사실 / 요즘애들 |
| `ratio` | `4:5`(기본) / `1:1` / `9:16` |
| `background` | 표지 배경 이미지 경로. 예: `backgrounds/policy-01.png`. 비우면(`null`) 기본 배경 |

슬라이드 종류:
- `cover` (표지): `kicker`(상단 꼬리표), `title`(큰 제목), `sub`(한 줄 설명)
- `body` (본문): `heading`(소제목), `text`(본문), `note`(점선 박스), `emoji`(오른쪽 아래 큰 이모지)

글자 규칙:
- `\n` = 줄바꿈
- `*단어*` = 강조 (표지에선 포인트 색, 본문에선 검은 박스)

## 폴더 구조

```
younggazine/
├─ render.js          카드 그리는 프로그램
├─ templates/card.html 디자인 (색·크기·글꼴은 맨 위 :root 에서 수정)
├─ content/           카드뉴스 원고(JSON)
├─ backgrounds/       배경 이미지 창고 (3단계에서 GPT가 채움)
├─ output/            완성된 PNG
└─ .env.example       API 키 자리 (복사해서 .env 로 이름 변경 후 키 입력)
```

## 다음 단계

- 2단계: 디스코드에서 소재 ✅ → Claude가 이 JSON을 자동으로 작성
- 3단계: GPT로 배경 생성 → `backgrounds/`에 저장 후 재사용

## 디자인 옵션 (원고 JSON에서 바꾸기)

| 항목 | 값 | 설명 |
|---|---|---|
| `coverFont` | `Black Han Sans`(기본) / `Jua` / `Do Hyeon` / `Gasoek One` | 표지 제목 글꼴. 본문은 항상 Pretendard |
| `bodyStyle` | `glass` / `dark` / `card` | glass: 배경 위 흰 반투명 박스, dark: 배경을 어둡게 + 흰 글씨, card: 흰 카드 |
| 장별 `style` | 위와 같음 | 특정 장만 다른 스타일로 |
| 장별 `background` | 이미지 경로 | 특정 장만 다른 배경으로 (없으면 표지 배경을 흐리게 깔아 씀) |
| 표지 `credit` | 예: `AI 생성 이미지` | 왼쪽 위 작은 글씨 |

글꼴은 전부 무료 상업용 가능(OFL) 글꼴이고 `fonts/`에 들어 있어서 인터넷 없이도 렌더링돼요.

## 로고

- 카드에 들어가는 로고: `templates/logo.svg`
- 인스타 프로필 사진용: `logo/profile-A-monogram.png`, `logo/profile-B-wordmark.png` (1080×1080)

## 폰으로 받기 (디스코드)

`.env`에 `DISCORD_WEBHOOK_URL=`을 넣어두면, 렌더링이 끝날 때 디스코드 채널로 사진(순서대로)과 캡션이 자동으로 올라와요.
- 캡션은 `content/<원고이름>-caption.txt`에서 `---` 위쪽만 보내요 (출처 메모는 안 보냄).
- 보내지 않고 파일만 만들려면: `npm run render -- content/파일.json --no-send`

## 영거진 스튜디오 (폰·PC에서 사진 저장, 문구 복사)

`start-studio.bat` 더블클릭 (또는 `npm run studio`) → 검은 창에 나오는 주소로 접속하세요.
- 이 컴퓨터: `http://localhost:3939`
- 같은 와이파이의 폰: `http://<서브컴IP>:3939` (창에 표시돼요)

할 수 있는 것: 게시물 미리보기, **사진 전체 저장**, **캡션·해시태그 복사**, ZIP 받기, 다시 렌더, 디스코드로 보내기, 48시간 성과 기록과 변수별 비교, 배경 창고.
- `.env`에 `STUDIO_PIN=숫자`를 넣으면 접속할 때 PIN을 물어봐요.
- 폰에서 사진 여러 장을 한 번에 앨범에 저장하는 기능은 https 주소(테일스케일)에서 가장 잘 동작해요. 그냥 주소에서는 한 장씩 내려받아요.
- n8n에서는 `POST http://host.docker.internal:3939/api/render` (본문 `{"file":"원고.json","send":true}`)로 렌더를 시킬 수 있어요.

### 스튜디오에서 할 수 있는 것 (v2)
- **원고 편집**: 게시물 → ✏️ 원고 편집. 장별 글자·목록 항목·캡션·해시태그 수정 → 저장(또는 저장하고 렌더링). 저장할 때마다 이전 버전이 `content/.bak/`에 백업돼요. 고급 칸에서 JSON 직접 수정도 가능.
- **렌더 진행 표시**: 렌더링 중 "3 / 6장" 막대.
- **배경 추천**: 게시물 설정 칸에 창고 배경 중 재사용 후보 3개(완성본 우선). '이 배경으로' 누르면 원고에 지정.
- **배경 만들기**: 배경 창고 → 프롬프트 고르거나 새로 쓰기 → 이름 → 품질(low 기본, medium/high는 확인창). 하루 상한은 `.env`의 `BG_DAILY_LIMIT`(기본 5). 같은 이름은 다시 안 만듦.
- **업로드 표시**: 인스타에 올린 뒤 '📤 인스타에 올렸어요'를 누르면 48시간 뒤 디스코드로 성과 입력 알림이 와요(n8n 필요).

### 자동 실행 / 끄기
| 하고 싶은 것 | 실행 |
|---|---|
| 로그인할 때 자동으로 켜기(최소화 창, 꺼지면 5초 뒤 재시작) | `autostart-on.bat` |
| 자동 실행 끄기 | `autostart-off.bat` |
| 지금 스튜디오 끄기(재시작 포함) | `stop-studio.bat` |
| 상태 보기 | `powershell -File scripts\studio-control.ps1 status` |

기록은 `data\studio.log`에 쌓여요.

### 폰에서 https로 (테일스케일)
1. 테일스케일 관리 페이지에서 Serve를 한 번 켜기 (처음 한 번만)
2. `tailscale-serve.bat` 실행 → 나오는 `https://desktop-krlmcko....ts.net` 주소를 폰에서 열기 (폰에도 테일스케일 앱 + 같은 계정)
- 테일넷 안에서만 열려요(인터넷 공개 아님). 닫기: `tailscale serve reset`
- 디스코드 알림에 링크를 넣으려면 `.env`에 `STUDIO_PUBLIC_URL=https://...ts.net` 추가

### n8n 리마인드
`n8n/younggazine-reminders.json` — 매일 21시 "오늘 렌더한 게시물/성과 입력할 차례" 알림, 매시 5분(9~23시) "48시간 지남" 알림(게시물당 한 번). 디스코드 주소는 n8n에 넣지 않고 스튜디오가 `.env`의 웹훅으로 보내요.
- API: `GET /api/reminders`(목록), `POST /api/remind {"kind":"daily"|"48h","dry":true}`(dry면 보내지 않고 문구만)
- `STUDIO_PIN`을 켰다면 n8n HTTP 노드의 `X-Studio-Pin` 헤더에 PIN을 넣으세요.

## 브랜드 프리셋 (다른 계정용)
`brands/<이름>.json`(계정명·로고·포인트 색)을 만들고 원고에 `"brand": "<이름>"`을 넣으면 같은 렌더러로 다른 계정 카드가 나와요. 자세한 건 `brands/README.md`.

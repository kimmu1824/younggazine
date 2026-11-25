# 브랜드 프리셋

같은 렌더러로 다른 계정(쿠팡파트너스, 스레드 등) 카드를 만들 때 씁니다.

1. `younggazine.json`을 복사해 `brands/<이름>.json`으로 저장 (예: `coupang.json`)
2. `handle`(카드 아래 계정명), `logo`(SVG 경로), `defaultAccent`·`accents`(카테고리별 포인트 색)를 바꿉니다.
3. 원고 JSON에 `"brand": "coupang"`을 넣고 렌더하면 그 브랜드로 나옵니다. (없으면 영거진)

로고는 정사각형 SVG 권장 (`templates/logo.svg` 참고).

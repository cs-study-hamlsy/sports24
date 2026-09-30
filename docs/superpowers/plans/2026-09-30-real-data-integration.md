# 운동24 실측 데이터 완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 시연값인 지역별 종목 강좌를 공공 API 실측값으로 전환하고, 인구·시설·강좌 데이터의 최신성·결합률·출처를 검증 가능한 형태로 제공한다.

**Architecture:** 행정안전부 인구 API, 전국체육시설 API, 스포츠강좌 API, 문화공공데이터 시설 API를 빌드 시점에 수집해 13개 대상 지역의 정적 데이터로 정제한다. 강좌의 `(brno, facil_sn)`과 문화공공데이터 시설 레코드 URL의 `(bizrno, alsfcSn)`을 결합 키로 사용하고, 모든 페이지 수집·중복 제거·결합률 검증이 끝난 뒤에만 `data/regions.json`과 `data/candidates.ts`를 교체한다. 실시간 조회용 Route Handler는 유지하고 정책 계산은 검증된 정적 스냅샷만 소비한다.

**Tech Stack:** Next.js 16.3.6 App Router Route Handlers, TypeScript 7, Node.js/tsx, node:test, 공공데이터포털 REST API, 문화공공데이터광장 REST API

**Spec:** `TODO.md`의 “다음에 구현할 부분 — 실측 데이터·외부 조치 필요”, `PROJECT_CONTEXT.md`의 “핵심 데이터” 및 “공모전 데모 범위”

## Global Constraints

- API 키는 서버/빌드 환경변수에서만 읽고 브라우저 번들, 로그, fixture, Git에 남기지 않는다.
- 초기 버전은 데이터베이스 없이 정제된 로컬 JSON/TypeScript 스냅샷을 사용한다.
- AI는 수치를 생성하지 않으며 코드로 계산된 값만 해석한다.
- 연령별 실제 수요 자료가 확보되기 전까지 연령 적합도는 계속 “산출 불가”로 둔다.
- 일부 페이지 실패나 결합률 미달 상태에서 기존 데이터 파일을 부분 덮어쓰지 않는다.
- Next.js Route Handler는 `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`의 Web Request/Response 규약과 기본 비캐시 동작을 따른다.

## 조사 근거 (2026-09-30 실제 호출)

- 스포츠강좌 API: HTTP 200, 전체 조회 `totalCount=66,919`; 태권도 필터는 `totalCount=20,870`. 원 응답에는 `brno`, `facil_sn`, `course_no`, `item_nm`, `course_nm`, `start_tm`, `equip_tm` 등이 있다.
- 강좌 전체 병렬 탐색은 67페이지 중 11,000행을 받은 뒤 HTTP 429가 발생했다. 이 부분 표본에서는 `brno`·`facil_sn`·`course_no`·`item_nm` 누락이 0건이었고 `course_no` 중복이 69건이었다. 따라서 실제 수집기는 순차 호출, 429 재시도, 최종 수집 건수 일치 검사가 필수다.
- 전국체육시설 API: 원주시 필터 HTTP 200, `totalCount=1,259`; `faci_cd`, 주소, 시설유형, 상태는 있지만 `brno`·`facil_sn`은 없다. 강좌 API와 직접 결합할 수 없다.
- 원주시 정상운영 시설 재집계는 758개이며 대표 유형은 간이운동장 216, 체력단련장 75, 수영장 1, 축구장 14, 테니스장 10이다. 저장된 값 926/96/1/14/10과 달라 현재 스냅샷의 시설 값은 최신 상태가 아니다.
- 인구 API: 원주시 25개 읍면동, 총 365,379명, 연령 비중 15.8/23.4/39.6/21.2로 저장값과 일치한다.
- 문화공공데이터 시설 API: 현행 URL은 `https://api.kcisa.kr/openapi/service/rest/meta2018/getKSPD0720183`; `serviceKey`, `numOfRows`, `pageNo`를 받는다. 샘플의 `url`에는 `bizrno`와 `alsfcSn`이 포함되어 강좌 키와 결합 가능하다. 다만 별도 KCISA 키가 필요하며 무키 호출은 401, 현재 공공데이터포털 키 재사용은 403이었다.

## Global Review Focus

- 한 페이지라도 401/403/429/5xx이면 수집을 성공으로 처리하거나 기존 스냅샷을 덮어쓰지 않는지.
- `course_no` 중복과 같은 강좌가 여러 페이지에 중복 등장해도 지역·종목 합계가 부풀지 않는지.
- 사업자번호의 선행 0, 시설일련번호의 문자열 표현, URL 인코딩 차이에도 결합 키가 안정적인지.
- 강원도/강원특별자치도 같은 행정구역 명칭 변경과 주소 공백 차이에도 13개 대상 지역이 올바르게 매핑되는지.
- 문화공공데이터 시설 목록과 강좌 목록의 시점 차이로 생긴 미결합 행을 숨기지 않고 건수·비율로 노출하는지.

---

### Task 1: KCISA 키 확보와 API 계약 고정

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Create: `docs/data-contracts/sports-course-facility.md`

**Interfaces:**
- Consumes: 문화공공데이터광장 활용신청으로 발급된 `KCISA_API_KEY`
- Produces: 네 API의 엔드포인트, 필드, 페이지 규칙, 오류 응답, 결합 키를 기록한 계약 문서

- [ ] **Step 1: 문화공공데이터광장에서 API id 401 활용신청 후 `KCISA_API_KEY`를 `.env.local`에 설정한다**

  키는 공공데이터포털 키와 별도다. `getKSPD0720183`에 `numOfRows=2&pageNo=1`로 호출해 HTTP 200과 정상 메시지 코드 `0000`을 확인한다.

- [ ] **Step 2: 응답 계약을 실제 성공 응답으로 기록한다**

  `docs/data-contracts/sports-course-facility.md`에 최상위/본문/행 필드, 총건수, 페이지 크기 상한, `url`에서 추출한 `bizrno`·`alsfcSn`, 주소 필드의 실제 위치를 기록한다. 실제 키와 전체 사업자번호는 기록하지 않는다.

- [ ] **Step 3: 환경변수 문서를 갱신한다**

  `.env.example`과 `README.md`에 `KCISA_API_KEY`의 목적, 발급처, 서버/빌드 전용임을 추가한다.

- [ ] **Step 4: KCISA 계약을 실제 호출로 확인한다**

  Run: `curl.exe --get "https://api.kcisa.kr/openapi/service/rest/meta2018/getKSPD0720183" --data-urlencode "serviceKey=$env:KCISA_API_KEY" --data-urlencode "numOfRows=2" --data-urlencode "pageNo=1"`

  Expected: HTTP 200 응답 본문의 정상 메시지 코드가 `0000`이고 시설 행의 `url`에 `bizrno`와 `alsfcSn`이 있음.

- [ ] **Step 5: Commit**

  ```bash
  git add .env.example README.md docs/data-contracts/sports-course-facility.md
  git commit -m "docs: record sports data API contracts"
  ```

### Task 2: 공공 스포츠 데이터 정규화·결합 로직

**Files:**
- Create: `lib/public-sports-data.ts`
- Create: `lib/public-sports-data.test.ts`

**Interfaces:**
- Consumes: `RawCourseRow`, `RawKcisaFacilityRow`, 대상 지역의 `provinceLabel`·`shortName`
- Produces: `courseJoinKey(brno: string, facilSn: string): string`, `parseFacilityIdentity(url: string): { brno: string; facilSn: string } | null`, `normalizeSport(itemName: string, courseName: string): string`, `aggregateCoursesByRegion(courses, facilities, regions): CourseAggregationResult`

- [ ] **Step 1: URL 결합 키 파싱 실패 테스트를 작성한다**

  `parseFacilityIdentity`가 `...?bizrno=4079027098&alsfcSn=25288`을 `{ brno: "4079027098", facilSn: "25288" }`로 만들고, 키가 없거나 URL이 잘못되면 `null`을 반환하는 테스트를 작성한다.

- [ ] **Step 2: 지역·종목 집계 테스트를 작성한다**

  동일 `course_no` 중복 제거, 선행 0 사업자번호 보존, `강원도`→`강원특별자치도` 별칭, 미결합 강좌 분리, 지역별 종목 합계·결합률을 synthetic fixture로 검증한다.

- [ ] **Step 3: 세부 종목 정규화 테스트를 작성한다**

  API의 `item_nm` 33종을 우선 사용하고, `기타종목`은 `course_nm`의 명시적 키워드가 있을 때만 세부 종목으로 분리한다. 판별 불가 항목은 `기타종목(미분류)`로 보존해 임의 추정하지 않는다.

- [ ] **Step 4: 테스트가 실패하는지 확인한다**

  Run: `npm test`

  Expected: `public-sports-data` export가 없어 FAIL.

- [ ] **Step 5: 최소 정규화·결합 함수를 구현한다**

  함수는 네트워크나 파일 I/O 없이 순수 함수로 유지하고, `CourseAggregationResult`에 `sourceRows`, `uniqueCourses`, `matchedCourses`, `unmatchedCourses`, `joinRate`, `regions`를 포함한다.

- [ ] **Step 6: 단위 테스트와 타입 검사를 실행한다**

  Run: `npm test`

  Expected: PASS.

  Run: `npm run typecheck`

  Expected: exit 0.

- [ ] **Step 7: Commit**

  ```bash
  git add lib/public-sports-data.ts lib/public-sports-data.test.ts
  git commit -m "feat: normalize and join public sports courses"
  ```

### Task 3: 전 페이지 수집기와 원자적 스냅샷 생성

**Files:**
- Rename: `scripts/build-real-data.mjs` → `scripts/build-real-data.ts`
- Modify: `package.json`
- Modify: `lib/public-sports-data.ts`
- Modify: `lib/public-sports-data.test.ts`
- Modify: `data/regions.json`
- Modify: `data/candidates.ts`
- Modify: `data/demo-data.test.ts`

**Interfaces:**
- Consumes: Task 2의 정규화 함수, `POPULATION_API_KEY`, `SPORTS_FACILITY_API_KEY`, `SPORTS_COURSE_API_KEY`, `KCISA_API_KEY`
- Produces: `npm run build-data`, `npm run build-data -- --check`, `npm run build-data -- --probe`; 13개 지역의 검증된 정적 스냅샷

- [ ] **Step 1: 완전성·실패 보존 테스트를 작성한다**

  응답 `totalCount`와 실제 수집 건수가 다르거나 중간 페이지가 429이면 실패하고 출력 파일을 쓰지 않는 테스트, 동일 `course_no` 중복을 제거한 뒤 건수를 검증하는 테스트를 추가한다.

- [ ] **Step 2: 현재 테스트가 실패하는지 확인한다**

  Run: `npm test`

  Expected: 새 완전성 검증 함수가 없어 FAIL.

- [ ] **Step 3: 수집기를 TypeScript로 전환한다**

  `fetchAllPages<T>(requestPage, options): Promise<T[]>`를 만들고 동시성 1, `Retry-After` 우선, 429/5xx 지수 백오프, 최대 재시도, 요청 타임아웃을 적용한다. 모든 결과는 메모리에서 검증하고 성공 후 임시 파일을 rename해 두 출력물을 교체한다.

- [ ] **Step 4: 데이터 품질 게이트를 구현한다**

  각 소스의 보고 총건수와 수집 건수 일치, 강좌 필수 키 공백 0, 13개 지역 모두 존재, 인구 합계 양수, 종목 합계 양수, 결합·미결합 건수 합계 일치를 검사한다. 결합률은 결과와 로그에 남기며 미달 기준은 첫 KCISA 성공 응답의 실제 분포를 본 뒤 계약 문서에 확정한다.

- [ ] **Step 5: check/probe 모드를 구현한다**

  `--probe`는 각 API 1페이지만 검증하고, `--check`는 전체 수집·정제 후 저장 파일과 비교하되 파일을 쓰지 않는다. 기본 모드만 스냅샷을 갱신한다.

- [ ] **Step 6: 실측 스냅샷을 재생성한다**

  Run: `npm run build-data -- --check`

  Expected: 원주시 시설 저장값 926와 실측 758의 차이 및 강좌 전환 차이를 출력하고 파일은 변경하지 않음.

  Run: `npm run build-data`

  Expected: 13개 지역 인구·시설·강좌 수집 완료, 결합률/미결합 수 출력, `regions.json`·`candidates.ts` 갱신.

- [ ] **Step 7: 회귀 검증을 실행한다**

  Run: `npm test`

  Expected: 모든 지역이 같은 실측 종목 카탈로그를 갖고 share 합계가 반올림 오차 범위에서 100이며 PASS.

  Run: `npm run typecheck`

  Expected: exit 0.

- [ ] **Step 8: Commit**

  ```bash
  git add package.json package-lock.json scripts/build-real-data.ts data/regions.json data/candidates.ts data/demo-data.test.ts
  git commit -m "feat: build verified regional sports snapshots"
  ```

### Task 4: 실측 종목 카탈로그를 계산 엔진과 시나리오에 연결

**Files:**
- Modify: `lib/regions.ts`
- Create: `lib/regions.test.ts`
- Modify: `lib/simulation.ts`
- Modify: `lib/simulation.test.ts`
- Modify: `data/scenarios.ts`
- Modify: `data/demo-data.test.ts`

**Interfaces:**
- Consumes: Task 3의 지역별 실측 `courses`
- Produces: 실제 종목 수와 0건 종목을 안전하게 다루는 유사지역·다양성·편중도·시나리오 계산

- [ ] **Step 1: 가변 종목 카탈로그 회귀 테스트를 작성한다**

  기존 “지역마다 정확히 10종” 가정을 제거하고 모든 지역의 종목 키 집합 일치, 0건 종목 허용, 실제 강좌 총량이 유사지역 거리와 비교 비중에 반영됨을 검증한다.

- [ ] **Step 2: 저장된 옛 시나리오 호환 테스트를 작성한다**

  사라진 종목 변경값은 무시하고, 이름이 바뀐 기존 `요가·필라테스` 등은 명시적 migration table로 새 카탈로그에 변환하며, 사용자 저장안이 유실되지 않는지 검증한다.

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

  Run: `npm test`

  Expected: 10종 고정 가정 또는 이전 이름 불일치로 FAIL.

- [ ] **Step 4: 계산·시나리오 로직을 최소 수정한다**

  종목 수에 따라 Shannon 정규화 분모를 계산하고, 비교지역에 없는 종목은 0으로 정렬한다. 시나리오 기본안은 대상 지역에 실제 존재하는 종목만 사용한다.

- [ ] **Step 5: 테스트와 타입 검사를 실행한다**

  Run: `npm test`

  Expected: PASS.

  Run: `npm run typecheck`

  Expected: exit 0.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/regions.ts lib/regions.test.ts lib/simulation.ts lib/simulation.test.ts data/scenarios.ts data/demo-data.test.ts
  git commit -m "feat: calculate policy metrics from measured courses"
  ```

### Task 5: 화면의 출처·기준시점·품질 표기 전환

**Files:**
- Modify: `app/sports24.tsx`
- Modify: `app/course-share-chart.tsx`
- Modify: `app/extended-pages.tsx`
- Modify: `app/public/public-pages.tsx`
- Modify: `PROJECT_CONTEXT.md`
- Modify: `TODO.md`

**Interfaces:**
- Consumes: 스냅샷의 인구 기준월, 시설/강좌 수집일, 결합률, 미결합 건수
- Produces: 담당자·시민·보고서 화면에서 일관된 실측/미분류/기준시점 안내

- [ ] **Step 1: 화면 문구와 표를 갱신한다**

  “강좌 시연값”을 “스포츠강좌 API 실측 정제값”으로 바꾸고 인구 기준월, 시설/강좌 수집일, 강좌 결합률을 별도 표시한다. 실시간 강좌 검색은 전체 API 조회이며 지역 통계 스냅샷과 목적이 다름을 설명한다.

- [ ] **Step 2: 문서를 갱신한다**

  `PROJECT_CONTEXT.md`에 실제 결합 방식·미결합 처리·종목 분류를 기록하고 `TODO.md`의 강좌 실측 및 기타 버킷 항목은 검증 완료 후에만 체크한다. 시설 값 최신성 검증 절차도 기록한다.

- [ ] **Step 3: 남은 시연 문구를 정적 확인한다**

  Run: `rg -n "강좌.*시연값|종목별 강좌.*시연값" app PROJECT_CONTEXT.md TODO.md`

  Expected: 과거 상태 설명 외에는 결과가 없고, 담당자·시민·보고서 화면의 현재 데이터 라벨은 모두 실측 정제값을 사용함.

- [ ] **Step 4: 전체 검증을 실행한다**

  Run: `npm test`

  Expected: PASS.

  Run: `npm run typecheck`

  Expected: exit 0.

  Run: `npm run build`

  Expected: Next.js production build 성공.

- [ ] **Step 5: Commit**

  ```bash
  git add app/sports24.tsx app/course-share-chart.tsx app/extended-pages.tsx app/public/public-pages.tsx PROJECT_CONTEXT.md TODO.md
  git commit -m "feat: disclose measured sports data quality"
  ```

### Task 6: 운영 검증과 남은 TODO 분리

**Files:**
- Modify: `TODO.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: 완성된 실측 데이터 흐름
- Produces: 실제 브라우저·Vercel 검증 기록과 별도 후속 과제

- [ ] **Step 1: 실제 브라우저 회귀 테스트를 수행한다**

  13개 지역 전환, 유사지역 변화, 강좌 합계, CSV 저장, 시뮬레이션 전후 지표, 시민 화면, 콘솔 오류를 확인한다. CSV에는 화면과 같은 실측 강좌 합계와 출처 메타데이터가 포함되어야 한다.

- [ ] **Step 2: Vercel 환경변수와 프로덕션을 검증한다**

  `SPORTS_COURSE_API_KEY`, `SPORTS_FACILITY_API_KEY`, `POPULATION_API_KEY`, `KCISA_API_KEY`, `OPENAI_API_KEY`를 설정하고 배포 후 `/api/courses`, `/api/facilities`, 주요 페이지를 smoke test한다.

- [ ] **Step 3: 데이터가 없는 후속 과제를 별도 계획으로 남긴다**

  연령 적합도/실수요, 시설 입지·수용인원·운영비는 현재 확인된 네 API로 만들 수 없다. 검증된 신규 데이터셋을 확보하기 전까지 산출 불가/시연 입력을 유지한다. 시민 공개 승인 절차는 데이터 수집과 독립된 제품 기능이므로 별도 계획으로 분리한다.

- [ ] **Step 4: TODO를 증거 기준으로 갱신한다**

  API 성공 응답, 전체 건수 일치, 결합률, 브라우저 검증, 배포 확인이 남은 항목별 완료 조건이다. 외부 키 미발급이나 데이터 부재는 완료로 체크하지 않는다.

- [ ] **Step 5: Commit**

  ```bash
  git add TODO.md README.md
  git commit -m "docs: record real-data verification status"
  ```

## Self-Review 결과

- Spec coverage: 실측 강좌 전환, 기타 세분화, 데이터 최신성, CSV/배포를 포함했다. 연령 수요·시설 비용·공개 승인 워크플로는 데이터 근거가 없어 별도 후속 과제로 명시했다.
- Type consistency: 결합 키는 전 구간에서 문자열이며 `brno|facilSn` 순서를 유지한다.
- Failure coverage: 401/403/429/5xx, 부분 페이지, 중복, 행정구역 명칭 변경, 미결합을 소유 Task의 테스트에 배치했다.
- Scope: 데이터베이스·실시간 동기화는 추가하지 않고 현재 공모전용 정적 정제 구조를 유지한다.

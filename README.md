# 운동24 / SPORTS24

## 프로젝트 개요

운동24는 지역별 체육시설, 스포츠강좌, 연령별 인구 데이터를 함께 분석해 현재 체육공급 구조를 공개하고, 시설·강좌 조정에 따른 정책 효과를 시행 전에 비교하는 공모전용 체육정책 시뮬레이션 서비스다. 정책 담당자는 제한된 자원으로 시나리오를 실험하고, 시민은 지역 체육현황과 정책 변화의 주요 결과를 확인할 수 있다.

## 기술 스택

- Next.js App Router, TypeScript
- Tailwind CSS
- Recharts 또는 동급의 가벼운 차트 라이브러리
- 사전 정제한 로컬 JSON 데이터(초기 버전은 데이터베이스 없음)
- Next.js Route Handler와 OpenAI API
- Vercel

## 로컬 실행 방법

Node.js 20 이상과 npm을 사용한다. 저장소 루트에서 다음 명령으로 실행한다.

```bash
npm install
npm run dev
```

브라우저에서 터미널에 표시된 로컬 주소(기본값 `http://localhost:3000`)를 연다.

## 환경변수

로컬에서는 루트의 `.env.local`에 다음 값을 설정한다.

```dotenv
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o-mini
SPORTS_COURSE_API_KEY=your_data_go_kr_service_key
SPORTS_FACILITY_API_KEY=your_data_go_kr_service_key
POPULATION_API_KEY=your_data_go_kr_service_key
```

`OPENAI_API_KEY`는 서버의 `/api/analyze` Route Handler에서만 사용하는 AI 분석 인증키다. `OPENAI_MODEL`은 선택값으로 지정하지 않으면 `gpt-4o-mini`를 사용한다. `SPORTS_COURSE_API_KEY`·`SPORTS_FACILITY_API_KEY`는 각각 `/api/courses`·`/api/facilities`에서 쓰는 data.go.kr 인증키이고, `POPULATION_API_KEY`는 행정안전부 인구 odcloud API 인증키다. 세 키는 모두 서버 Route Handler에서만 사용하며 브라우저에 노출하지 않는다. 키가 없어도 나머지 화면은 열린다.

`data/regions.json`과 `data/candidates.ts`의 13개 지역 인구·시설 실측값은 `npm run build-data`로 재정제한다(`POPULATION_API_KEY`, `SPORTS_FACILITY_API_KEY` 필요). 인구는 2026-08 기준이며, 시설은 API 조회일에 정상운영 상태이고 대상 시·도 주소가 확인된 행만 센다. 주소의 시·도가 비어 있는 행은 지역 수치에 포함하지 않는다. 종목별 강좌는 시연값을 유지한다.

`SPORTS_COURSE_API_KEY`는 공공데이터포털에서 이 강좌 API에 활용신청한 인증키다. 발급받은 일반 키 또는 URL 인코딩된 키를 입력할 수 있다. API 키는 서버의 Route Handler에서만 사용하며 브라우저에 노출하지 않는다. 키가 없어도 기존 목업 데모 화면은 열리지만 실시간 강좌 조회는 사용할 수 없다.

## 배포 방법

Git 저장소를 Vercel 프로젝트에 연결하고 프레임워크를 Next.js로 설정한다. 실시간 조회를 위해 Vercel 프로젝트의 Environment Variables에 `SPORTS_COURSE_API_KEY`, `SPORTS_FACILITY_API_KEY`, `POPULATION_API_KEY`를 등록하고, AI 기능을 사용할 때는 `OPENAI_API_KEY`(선택 `OPENAI_MODEL`)도 등록한 뒤 재배포한다. 정제된 JSON 데이터는 애플리케이션과 함께 배포된다.

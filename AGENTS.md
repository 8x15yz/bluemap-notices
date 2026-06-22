# AGENTS.md

## Project Context
- 블루맵(주)가 지원하거나 수주할 수 있는 정부지원사업 · R&D 과제 · 입찰 · 인증 · 바우처 공고를 체계적으로 탐색 · 선별 · 관리하기 위함
- 블루맵의 핵심 역량(해양 표준 GIS SW, S-100, 해양공간정보, VTS 등)에 맞는 공고를 자동 선별하고 등급화하는 시스템 필요

## Current Goal
- 나라장터 API 기반 웹 공고 큐레이션 + Slack 알림 + AI 전략 분석 MVP를 완성한다.

## Reference
- 나라장터 API 명세서 경로: `okurimono\reference\조달청_OpenAPI참고자료_나라장터_공공데이터개방표준서비스_1.2.docx`
- 과기정통부(MSIT) 사업공고 OpenAPI 명세서 경로: `okurimono\reference\OpenApi활용가이드_과학기술정보통신 부 공공데이터_사업공고_v1.0.docx`
- MVP에서는 나라장터만 구현하고, MSIT/기업마당/e나라도움/IRIS 등은 후속 수집원 후보로 둔다.

## Tech Stack
- Next.js + TypeScript
- Postgres
- Slack Incoming Webhook 또는 Slack Bot
- `kordoc` 기반 PDF/HWPX 문서 파싱
- OpenAI/Claude 교체 가능한 LLM adapter 구조

## Coding Rules
- TypeScript 타입을 명시한다.
- API 호출 로직은 `lib/api` 또는 `services` 계층에 둔다.
- UI 컴포넌트에는 비즈니스 로직을 과하게 넣지 않는다.
- 기존 파일 구조를 최대한 유지한다.
- 큰 리팩토링은 사전에 계획을 먼저 제안한다.
- AGENTS를 제외한 Markdown 포맷 파일은 전부 docs 폴더에 생성/저장한다.
- 공고 출처별 API 호출과 필드 매핑은 `NoticeSource` 어댑터로 분리한다.
- Slack 알림, 키워드 필터, 점수화, AI 분석 로직은 특정 출처에 종속시키지 않는다.
- 작업이 끝날 때 마다 반드시 `docs/PLAN.md`의 Task는 체크박스로 관리하고, 완료된 항목은 `[x]`로 표시해 진행상황을 시각화한다.

## Product Rules
- 사용자는 개발자가 아닌 운영자라고 가정한다.
- 화면 문구는 기능 설명보다 행동 유도 중심으로 작성한다.
- 지연 업무는 단순 나열이 아니라 우선순위가 보이게 정렬한다.
- MVP 본체는 웹사이트이며, Slack은 새 후보 공고 알림과 상세 URL 진입을 맡는다.
- 첨부파일 분석은 웹 상세 페이지 업로드로 처리한다.
- 키워드에 걸린 나라장터 공고는 모두 후보로 저장하고 적합도 점수를 함께 보여준다.

## Do Not
- 기존 환경변수명을 바꾸지 않는다.
- 불필요한 패키지를 추가하지 않는다.
- 전체 구조를 갈아엎지 않는다.
- MVP 단계에서 나라장터 외 공고 출처를 구현하지 않는다.

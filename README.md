# BLUEMAP

나라장터 입찰공고를 블루맵 역량 키워드로 선별하고, 웹 상세 페이지와 Slack 알림으로 운영자가 빠르게 검토할 수 있게 하는 MVP입니다.

MVP 범위는 나라장터 공고 수집, 후보 공고 저장, 적합도 점수화, Slack 묶음 알림, 첨부파일 PDF/HWPX/HWP 분석, AI 전략 메모, 제안서 초안 작성입니다. MSIT, 기업마당, e나라도움, IRIS 등 후속 출처는 MVP 이후 확장 대상입니다.

## 안내사항

해당 README 파일에 서비스 환경 설정과 각 API KEY 발급 방식에 대해 명시해 두었습니다. 따라서 진행해주시면 될 것 같습니다.

## 주의사항

* AI 토큰 사용 기능이 있으니, 향후 로그인 또는 보안 로직 추가 구현 필요합니다.

## 인계 요약

서비스 환경 설정 및 배포는 아래와 같은 순서로 진행해주시면 됩니다.

1. Postgres DB를 준비한다 (EC2에서는 `docker-compose.yml`의 `postgres` 서비스가 담당한다).
2. 공공데이터포털에서 나라장터 API 활용 신청과 서비스 키 발급을 완료한다.
3. Slack 알림을 쓸 경우 Incoming Webhook URL을 만든다.
4. OpenAI를 쓸 경우 OpenAI API 키를 준비한다. API 비용 없이 확인하려면 `AI_PROVIDER=mock`으로 둔다.
5. `.env.example`을 기준으로 로컬 `.env`와 EC2 서버의 `.env`(`docker-compose.yml`이 읽는 파일)를 채운다.
6. DB 스키마를 적용한다.
7. `main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 이미지를 빌드해 GHCR에 올리고 EC2에 SSH로 배포한다.
8. `/api/health`, `/api/sync`, 웹 화면, Slack 알림을 확인한다.

`.env`에는 실제 비밀값이 들어가므로 커밋하지 않습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

Windows PowerShell에서는 아래처럼 실행해도 됩니다.

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run db:init
npm.cmd run dev
```

개발 서버 기본 주소는 `http://localhost:3000`입니다.

## 주요 명령

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run typecheck  # TypeScript 검사
npm test           # 단위 테스트
npm run db:init    # Postgres 스키마 적용
```

## 환경변수 설정

아래 값들은 `.env.example`과 EC2 서버의 `.env`에 같은 이름으로 입력합니다. 로컬 `.env`는 개발용 값, EC2 서버의 `.env`는 배포용 값을 넣습니다. `docker-compose.yml`이 `env_file: .env`로 컨테이너에 그대로 주입합니다.

| Key | 필수 여부 | 설정 방법 |
|---|---:|---|
| `DATABASE_URL` | 필수 | Postgres 접속 문자열입니다. 예: `postgres://USER:PASSWORD@HOST:PORT/DB_NAME`. Supabase, Neon, Railway, Render 등 외부 Postgres를 사용할 수 있습니다. |
| `PGSSLMODE` | 조건부 | 배포 DB가 SSL을 요구하면 `require`로 설정합니다. 로컬 Postgres는 보통 비워둡니다. |
| `G2B_SERVICE_KEY` | 필수 | 공공데이터포털에서 발급받은 나라장터 OpenAPI 서비스 키입니다. 인코딩 키 또는 일반 인증키 모두 사용할 수 있습니다. |
| `G2B_STANDARD_API_BASE_URL` | 필수 | 나라장터 공공데이터개방표준서비스 기본 URL입니다. 기본값은 `http://apis.data.go.kr/1230000/ao/PubDataOpnStdService`입니다. |
| `G2B_BID_PUBLIC_API_BASE_URL` | 필수 | 나라장터 입찰공고정보서비스 기본 URL입니다. 기본값은 `http://apis.data.go.kr/1230000/ad/BidPublicInfoService`입니다. |
| `APP_BASE_URL` | 필수 | 배포된 웹사이트 주소입니다. Slack 상세 보기 링크 생성에 사용합니다. 로컬은 `http://localhost:3000`, 배포는 `https://...` 형식으로 입력합니다. 마지막 `/`는 없어도 됩니다. |
| `SLACK_WEBHOOK_URL` | 선택 | Slack Incoming Webhook URL입니다. 비워두면 공고 수집은 계속되고 Slack 알림만 건너뜁니다. |
| `CRON_SECRET` | 배포 필수 | `/api/sync` 자동 수집 API 보호용 비밀값입니다. 로컬 개발 때는 비울 수 있지만, 배포 환경에서는 반드시 긴 랜덤 문자열로 설정합니다. `/api/admin/rescore-notices`도 이 값으로 인증할 수 있습니다. |
| `ADMIN_SECRET` | 선택 | `/api/admin/rescore-notices` 재채점 API 전용 비밀값입니다. 비워두면 `CRON_SECRET`만으로 인증합니다. |
| `AI_PROVIDER` | 필수 | `mock`, `openai`, `anthropic` 중 하나입니다. MVP 운영은 `mock` 또는 `openai`를 사용합니다. Anthropic 검증은 MVP에서 스킵했습니다. |
| `OPENAI_API_KEY` | 조건부 | `AI_PROVIDER=openai`일 때 입력합니다. 비워두면 OpenAI 호출을 하지 않습니다. |
| `OPENAI_MODEL` | 선택 | OpenAI 모델명입니다. 비워두면 코드 기본값 `gpt-4.1-mini`를 사용합니다. |
| `ANTHROPIC_API_KEY` | 후속 | MVP에서는 사용하지 않습니다. Claude를 후속으로 검증할 때만 입력합니다. |
| `ANTHROPIC_MODEL` | 후속 | MVP에서는 사용하지 않습니다. 비워두면 코드 기본값을 사용합니다. |
| `SYNC_LOOKBACK_DAYS` | 선택 | 자동 수집 시 며칠 전 공고부터 조회할지 정합니다. 기본값은 `2`입니다. |
| `SYNC_MAX_PAGES` | 선택 | 나라장터 목록 API를 몇 페이지까지 조회할지 정합니다. 기본값은 `3`이고, 페이지당 100건을 조회합니다. |

### `.env` 예시

실제 값은 아래 예시의 오른쪽 값을 교체해서 입력합니다.

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bluemap
PGSSLMODE=
G2B_SERVICE_KEY=공공데이터포털_서비스키
G2B_STANDARD_API_BASE_URL=http://apis.data.go.kr/1230000/ao/PubDataOpnStdService
G2B_BID_PUBLIC_API_BASE_URL=http://apis.data.go.kr/1230000/ad/BidPublicInfoService
APP_BASE_URL=http://localhost:3000
SLACK_WEBHOOK_URL=
CRON_SECRET=
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
SYNC_LOOKBACK_DAYS=2
SYNC_MAX_PAGES=3
```

## 키 발급과 입력 방법

### 1. Postgres

로컬에서만 확인할 경우 로컬 Postgres 또는 Docker Postgres를 사용할 수 있습니다.

```powershell
docker run --name bluemap-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bluemap -p 5432:5432 -d postgres:16
```

이 경우 `DATABASE_URL`은 아래처럼 둡니다.

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bluemap
PGSSLMODE=
```

배포 환경에서는 Supabase, Neon, Railway, Render 등에서 Postgres를 만들고 접속 문자열을 `DATABASE_URL`에 넣습니다. Supabase처럼 SSL이 필요한 DB는 `PGSSLMODE=require`도 함께 넣습니다.

DB가 준비되면 스키마를 한 번 적용합니다.

```powershell
npm.cmd run db:init
```

운영 DB에 적용할 때는 `.env`의 `DATABASE_URL`이 운영 DB를 가리키는지 먼저 확인해야 합니다.

### 2. 나라장터 OpenAPI

공공데이터포털에서 아래 두 서비스를 활용 신청합니다.

- 나라장터 공공데이터개방표준서비스
- 나라장터 입찰공고정보서비스

승인 후 발급된 서비스 키를 `G2B_SERVICE_KEY`에 넣습니다. 공공데이터포털에서 제공하는 인코딩 키 또는 일반 인증키 중 어느 쪽을 넣어도 됩니다.

기본 API URL은 `.env.example` 값을 그대로 사용합니다.

```dotenv
G2B_SERVICE_KEY=공공데이터포털_서비스키
G2B_STANDARD_API_BASE_URL=http://apis.data.go.kr/1230000/ao/PubDataOpnStdService
G2B_BID_PUBLIC_API_BASE_URL=http://apis.data.go.kr/1230000/ad/BidPublicInfoService
```

### 3. Slack

Slack 알림을 사용할 경우 Slack 앱 설정(사업공고 선택)에서 Incoming Webhook탭 선택 후 하단에 위치한 생성된 Webhook URL을 `SLACK_WEBHOOK_URL`에 넣습니다.

```dotenv
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

비워두면 Slack 알림만 생략되고 공고 수집과 DB 저장은 계속됩니다.

### 4. AI provider

API 비용 없이 전체 흐름만 확인하려면 아래처럼 둡니다.

```dotenv
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=
```

OpenAI로 실제 분석 메모와 제안서 초안을 생성하려면 아래처럼 설정합니다.

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=OpenAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_MODEL`을 비워두면 코드 기본값 `gpt-4.1-mini`를 사용합니다. 테스트는 GPT 5.4-mini로 진행되었습니다.

Claude 관련 값은 향후 필요 하실 때 추가해주시면 됩니다.

```dotenv
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

### 5. CRON_SECRET

`/api/sync`는 누구나 호출할 수 있지만(브라우저의 "공고 조회" 버튼 포함), **Slack 알림은 항상 막혀 있습니다.** `?source=cron` 파라미터로 호출하면서 `CRON_SECRET`이 일치하는 요청만 Slack 알림을 보냅니다. 배포 환경에서는 크론 알림을 쓰기 위해 `CRON_SECRET`을 반드시 설정합니다.

아래 명령으로 긴 랜덤 문자열을 만듭니다.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

생성된 값을 로컬 `.env`와 EC2 서버의 `.env`에 같은 값으로 넣습니다.

```dotenv
CRON_SECRET=생성한_긴_랜덤_문자열
```

`?source=cron`으로 호출할 때는 아래 헤더가 필요합니다. 헤더가 없거나 값이 일치하지 않으면 `401`을 반환하고 Slack을 보내지 않습니다.

```http
Authorization: Bearer <CRON_SECRET>
```

`source=cron` 없이(즉 수동 모드로) `/api/sync`를 호출하면 `CRON_SECRET` 설정 여부와 무관하게 인증 없이 동작합니다. 단, 이 경우 동기화는 실행되지만 Slack 알림은 절대 보내지 않습니다.

## EC2 / Docker 배포 절차

이 프로젝트는 Vercel이 아니라 **AWS EC2 + Docker Compose**로 배포합니다. `main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로:

1. Docker 이미지를 빌드해 GHCR(`ghcr.io/8x15yz/bluemap:latest`)에 push합니다.
2. SSH로 EC2(`secrets.SSH_HOST`)에 접속해 `docker compose pull && docker compose up -d`를 실행합니다.

처음 EC2 서버를 셋업할 때는 아래 순서로 진행합니다.

1. EC2 인스턴스에 Docker, Docker Compose를 설치합니다.
2. 저장소를 `/home/ubuntu/bluemap-notices`에 clone합니다 (`docker-compose.yml`이 이 경로에 있어야 GitHub Actions의 SSH 배포 스크립트가 동작합니다).
3. 같은 경로에 `.env` 파일을 만들고 아래 운영용 환경변수를 입력합니다. `docker-compose.yml`의 `app` 서비스가 `env_file: .env`로 그대로 읽습니다.
4. GitHub 저장소 Settings → Secrets에 `SSH_HOST`, `SSH_USER`, `SSH_KEY`를 등록합니다 (`GITHUB_TOKEN`은 자동 제공됩니다).
5. `npm run db:init`으로 DB 스키마를 적용합니다 (EC2에서 `postgres` 컨테이너가 뜬 뒤, 또는 컨테이너 안에서 실행).
6. `main`에 push하면 자동 배포가 시작됩니다. 처음에는 수동으로 `docker compose up -d`까지 한 번 실행해 컨테이너가 정상 기동하는지 확인합니다.
7. 배포 URL(또는 IP)을 `APP_BASE_URL`에 반영한 뒤 다시 배포합니다.

EC2 서버의 `.env`에는 최소한 아래 값을 넣습니다.

```dotenv
DATABASE_URL=postgres://postgres:postgres@postgres:5432/bluemap
PGSSLMODE=
G2B_SERVICE_KEY=공공데이터포털_서비스키
G2B_STANDARD_API_BASE_URL=http://apis.data.go.kr/1230000/ao/PubDataOpnStdService
G2B_BID_PUBLIC_API_BASE_URL=http://apis.data.go.kr/1230000/ad/BidPublicInfoService
APP_BASE_URL=https://배포도메인또는IP
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
CRON_SECRET=생성한_긴_랜덤_문자열
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=
ANTHROPIC_API_KEY= // 필요시
ANTHROPIC_MODEL=
SYNC_LOOKBACK_DAYS=5
SYNC_MAX_PAGES=10
```

`DATABASE_URL`의 호스트는 `docker-compose.yml`에서 Postgres 컨테이너의 서비스 이름인 `postgres`를 그대로 씁니다 (`app` 컨테이너가 같은 Docker 네트워크에서 `postgres` 호스트명으로 접근하기 때문). 외부 관리형 Postgres(Supabase 등)를 쓴다면 그 접속 문자열로 바꾸고 `PGSSLMODE=require`를 추가합니다.

OpenAI를 운영에 사용할 때만 아래처럼 바꿉니다.

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=OpenAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
```

### 자동 수집 스케줄링 (EC2 crontab)

Vercel Cron 대신 **EC2 서버의 crontab**이 매일 정해진 시간에 `/api/sync?source=cron`을 호출합니다 (`vercel.json`은 더 이상 쓰지 않아 삭제했습니다). `?source=cron`이 있어야 Slack 알림이 발송되므로, crontab 호출에는 반드시 붙여야 합니다. EC2에 SSH로 접속해 아래처럼 등록합니다.

```bash
crontab -e
```

```cron
# 평일 한국시간 오전 9:30 (서버 타임존이 UTC면 0:30으로 적습니다. timedatectl로 확인)
30 9 * * 1-5 curl -s -X POST -H "Authorization: Bearer <CRON_SECRET값>" "http://localhost:3000/api/sync?source=cron" >> /home/ubuntu/sync.log 2>&1
```

컨테이너가 EC2 호스트의 3000번 포트에 매핑돼 있어 호스트의 crontab에서 `localhost:3000`으로 바로 호출할 수 있습니다. 자세한 운영 규칙은 `docs/OPERATIONS.md`를 참고합니다.

## 배포 후 확인

### 1. Health check

```powershell
curl.exe https://배포도메인/api/health
```

정상 응답 예시:

```json
{
  "ok": true,
  "service": "BLUEMAP"
}
```

### 2. 수동 수집 확인

인증 없이 호출하면 수동 모드로 동작합니다(동기화는 실행되지만 Slack은 보내지 않습니다).

```powershell
curl.exe https://배포도메인/api/sync
```

정상 응답 예시(`notified`는 수동 모드에서 항상 `0`):

```json
{
  "fetched": 300,
  "stored": 10,
  "candidates": 10,
  "notified": 0,
  "skippedNotifications": 0
}
```

Slack 알림까지 발송되는 크론 모드를 확인하려면 `?source=cron`과 `CRON_SECRET`을 함께 호출합니다.

```powershell
curl.exe -X POST -H "Authorization: Bearer <CRON_SECRET>" "https://배포도메인/api/sync?source=cron"
```

`?source=cron`으로 호출했는데 인증 없이/잘못된 값으로 호출했을 때 `401 Unauthorized`가 나오면 `CRON_SECRET` 보호가 정상입니다.

### 3. 웹 화면 확인

- `https://배포도메인` 접속
- 후보 공고 목록 표시 확인
- 공고 카드 클릭 후 상세 페이지 이동 확인
- 첨부파일 링크와 분석 버튼 표시 확인
- 분석 가능한 PDF/HWPX/HWP 파일 분석 실행 확인
- 생성된 분석 메모와 제안서 초안 버튼 확인

### 4. Slack 확인

- 새 후보 공고가 있을 때 Slack 채널에 묶음 알림이 오는지 확인합니다.
- Slack 메시지의 공고 링크가 배포된 상세 페이지로 이동하는지 확인합니다.
- 이미 보낸 공고가 다시 중복 발송되지 않는지 확인합니다.

## 문제 해결

### `DATABASE_URL is required.`

`DATABASE_URL`이 비어 있거나 EC2 서버의 `.env`에 입력되지 않은 상태입니다. 로컬은 `.env`, 배포는 EC2 서버의 `/home/ubuntu/bluemap-notices/.env`를 확인하고 수정 후 `docker compose up -d`로 재기동합니다.

### DB SSL 오류

Supabase 등 외부 DB가 SSL을 요구하면 `PGSSLMODE=require`를 추가합니다.

### 나라장터 API 오류

아래를 확인합니다.

- `G2B_SERVICE_KEY`가 정확한지
- 공공데이터포털에서 두 나라장터 서비스 활용 신청이 승인됐는지
- `G2B_STANDARD_API_BASE_URL`, `G2B_BID_PUBLIC_API_BASE_URL`이 기본값과 같은지
- 서비스 키 앞뒤에 공백이 들어가지 않았는지

### Slack 알림이 오지 않음

`SLACK_WEBHOOK_URL`이 비어 있으면 알림은 의도적으로 건너뜁니다. 값이 있는데 실패하면 Slack Webhook URL, 채널 권한, EC2 컨테이너 로그(`docker compose logs -f app`)를 확인합니다. crontab으로 `/api/sync`를 호출하는 경우 크론 작업 자체가 실행됐는지(`/home/ubuntu/sync.log`)도 함께 확인합니다.

### `/api/sync`가 401을 반환함

`?source=cron`으로 호출했기 때문입니다. 이 모드는 항상 인증이 필요합니다 — `Authorization: Bearer <CRON_SECRET>` 헤더를 붙이거나, Slack 알림이 필요 없다면 `source=cron` 없이(수동 모드로) 호출합니다.

### AI 분석이 mock으로 생성됨

`AI_PROVIDER=openai`와 `OPENAI_API_KEY`가 모두 설정되어 있는지 확인합니다. 둘 중 하나가 없으면 mock 경로로 동작합니다.

## 문서

- 제품 요구사항: `docs/PRD.md`
- 운영 자동화 메모: `docs/OPERATIONS.md`
- 진행 계획: `docs/PLAN.md`
- 나라장터 공공데이터개방표준서비스 명세: `reference/조달청_OpenAPI참고자료_나라장터_공공데이터개방표준서비스_1.2.docx`
- 나라장터 입찰공고정보서비스 명세: `reference/조달청_OpenAPI참고자료_나라장터_입찰공고정보서비스_1.2.docx`

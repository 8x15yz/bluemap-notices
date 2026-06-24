# BLUEMAP 운영 자동화 메모

## 배포 운영 결정

- 배포 대상은 **AWS EC2 + Docker Compose**다 (`docker-compose.yml`: `postgres` + `app` 컨테이너). 원래는 Vercel + Vercel Cron으로 배포했으나, 인수인계 과정에서 EC2/Docker 운영으로 전환됐다.
- 배포 파이프라인은 GitHub Actions(`.github/workflows/deploy.yml`)다. `main` push 시 GHCR에 이미지를 push하고 SSH로 EC2에 접속해 `docker compose pull && up -d`를 실행한다.
- 자동 수집 기준 시간은 **평일 오전 9시 30분 KST**로 둔다.
- 스케줄링은 더 이상 Vercel Cron이 아니라 **EC2 서버의 crontab**이 담당한다 (`vercel.json`은 삭제됨). crontab은 EC2 호스트에 직접 등록해야 하므로 코드 배포만으로는 자동으로 생기지 않는다 — 새 EC2 인스턴스로 이전할 때마다 crontab을 다시 등록해야 한다.
- 실패 확인은 `docker compose logs -f app`과 crontab이 기록하는 로그 파일(예: `/home/ubuntu/sync.log`)로 한다. Slack 실패 알림은 운영 중 필요성이 확인되면 후속 작업으로 붙인다.

## EC2 `.env` 체크리스트

`/home/ubuntu/bluemap-notices/.env`(`docker-compose.yml`이 `env_file`로 읽는 파일)에 아래 값을 입력한다.

- `DATABASE_URL`
- `PGSSLMODE=require` (Supabase처럼 SSL이 필요한 DB일 때)
- `G2B_SERVICE_KEY`
- `G2B_STANDARD_API_BASE_URL`
- `G2B_BID_PUBLIC_API_BASE_URL`
- `APP_BASE_URL`
- `SLACK_WEBHOOK_URL`
- `SLACK_BOT_TOKEN` (Slack 쓰레드 답변을 쓸 때)
- `SLACK_CHANNEL_ID` (Slack Bot 묶음 알림 채널)
- `SLACK_SIGNING_SECRET` (Slack Events API 요청 검증)
- `CRON_SECRET`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ANTHROPIC_API_KEY` (Claude를 쓸 때만)
- `ANTHROPIC_MODEL` (Claude를 쓸 때만)
- `SYNC_LOOKBACK_DAYS`
- `SYNC_MAX_PAGES`

`CRON_SECRET`은 저장소에 커밋하지 않는다. 로컬에서 새 값을 만들 때는 아래처럼 생성한다.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## `/api/sync` 호출 규칙

- 자동 수집 엔드포인트는 `GET /api/sync`와 `POST /api/sync`를 모두 지원한다.
- `CRON_SECRET`이 비어 있으면 인증 없이 호출할 수 있다. 로컬 개발 확인용으로만 사용한다.
- `CRON_SECRET`이 설정되어 있으면 `Authorization: Bearer <CRON_SECRET>` 헤더가 없는 호출은 `401`로 차단된다.
- 성공 응답은 `fetched`, `stored`, `candidates`, `notified`, `skippedNotifications` 값을 반환한다.
- 실패 시 API는 `500`과 오류 메시지를 반환하고, 서버 로그에는 `[api/sync] Sync failed`가 남는다.

## 로컬 확인

```powershell
curl.exe http://localhost:3000/api/sync
```

`CRON_SECRET`을 설정한 상태에서는 아래처럼 호출한다.

```powershell
curl.exe -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/sync
```

## EC2 crontab 스케줄링

Vercel Cron이 아니라 **EC2 서버 자체의 crontab**이 매일 `/api/sync`를 호출한다. `docker-compose.yml`에서 `app` 컨테이너가 호스트의 3000번 포트에 매핑돼 있으므로 호스트 crontab에서 `localhost:3000`으로 바로 호출할 수 있다.

```bash
crontab -e
```

```cron
# 한국시간 평일 오전 9:30. 서버 타임존이 UTC면 30 0 * * 1-5로 적는다 (timedatectl로 확인)
30 9 * * 1-5 curl -s -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/sync >> /home/ubuntu/sync.log 2>&1
```

주의할 점:

- crontab은 EC2 인스턴스 자체에 등록되는 OS 설정이라 코드 저장소에 들어있지 않다. 인스턴스를 교체하거나 새로 띄울 때마다 다시 등록해야 한다.
- crontab 환경에서는 일반 로그인 셸의 환경변수(`$CRON_SECRET`)를 못 읽는 경우가 많으므로, 위처럼 변수 치환에 의존하지 말고 실제 값을 직접 박아 넣거나 crontab 맨 위에 `CRON_SECRET=값`을 선언해 둔다.
- 실패는 자동 재시도되지 않으므로, `sync.log`를 주기적으로 확인하거나 별도 모니터링이 필요하면 후속 작업으로 검토한다.
- 같은 호출 규칙(`Authorization: Bearer <CRON_SECRET>` + `GET /api/sync`)을 쓰므로, EC2 crontab 대신 외부 스케줄러(예: GitHub Actions의 `schedule` 트리거로 공개 URL을 호출)로 바꾸더라도 코드 변경은 필요 없다.

## 중복 Slack 알림 기준

수동 조회 버튼과 `/api/sync`는 모두 같은 `syncG2bNotices()` 서비스를 호출한다. Slack 발송 대상은 `slack_notifications`에 `sent` 기록이 없는 후보 공고만 조회하므로, 수동 조회 직후 자동 조회가 실행되어도 이미 발송된 공고는 다시 보내지 않는다.

동시에 두 요청이 오래 겹치는 운영 상황이 생기면 DB 기반 실행 잠금 또는 배포 플랫폼의 동시 실행 제한을 추가로 검토한다.

## Slack 쓰레드 답변

Slack Bot 기반 답변을 쓰려면 Incoming Webhook 대신 또는 함께 아래 값을 설정한다.

- `SLACK_BOT_TOKEN`: `chat.postMessage` 권한이 있는 Bot User OAuth Token
- `SLACK_CHANNEL_ID`: 후보 공고 묶음 알림을 보낼 채널 ID
- `SLACK_SIGNING_SECRET`: Slack Events API 요청 서명 검증용 Secret

Slack App의 Event Subscriptions Request URL은 `https://<APP_BASE_URL>/api/slack/events`로 설정한다. 사용자가 묶음 알림 쓰레드에 `3번 공고는 왜 적합도가 12점이야?`처럼 질문하면, 서버는 해당 Slack 묶음 알림의 3번째 공고를 찾아 짧게 답하고 웹 상세 링크를 함께 보낸다.

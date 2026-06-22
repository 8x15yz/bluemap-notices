# BLUEMAP 운영 자동화 메모

## 배포 운영 결정

- MVP 배포 대상은 **Vercel + 외부 Postgres(Supabase 등) + Vercel Cron**으로 둔다.
- 자동 수집 기준 시간은 **평일 오전 9시 30분 KST**로 둔다.
- `vercel.json`의 cron 표현식은 UTC 기준이므로 `30 0 * * 1-5`를 사용한다.
- Vercel Hobby 플랜은 cron이 하루 1회까지만 가능하고, 지정된 시간대 안에서 실행 시점이 다소 흔들릴 수 있다. 분 단위 정확도가 꼭 필요하면 Pro 이상으로 올린다.
- 실패 알림은 MVP에서는 **Vercel Runtime Logs / Cron Jobs View Logs**로 확인한다. Slack 실패 알림은 운영 중 필요성이 확인되면 후속 작업으로 붙인다.

## Vercel 환경변수 체크리스트

Production 환경에 아래 값을 입력한다.

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

## Vercel Cron 설정

Vercel 프로젝트 환경변수에 `CRON_SECRET`을 설정하면, Vercel이 cron 호출에 `Authorization: Bearer <CRON_SECRET>` 헤더를 자동으로 붙인다.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/sync",
      "schedule": "30 0 * * 1-5"
    }
  ]
}
```

위 설정은 이미 루트 `vercel.json`에 반영되어 있다. UTC 기준 평일 00:30, 한국시간으로는 평일 오전 9:30에 실행된다. Vercel Cron은 실패 호출을 자동 재시도하지 않으므로, 실패 여부는 Vercel 함수 로그에서 확인한다.

참고:

- [Vercel Cron Jobs 관리 문서](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel Cron Jobs 사용량/요금 문서](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## 외부 스케줄러 예시

Vercel이 아닌 배포 환경이나 외부 스케줄러를 쓰는 경우에도 같은 HTTP 호출만 유지하면 된다.

```bash
curl -fsS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  https://bluemap.example.com/api/sync
```

## 중복 Slack 알림 기준

수동 조회 버튼과 `/api/sync`는 모두 같은 `syncG2bNotices()` 서비스를 호출한다. Slack 발송 대상은 `slack_notifications`에 `sent` 기록이 없는 후보 공고만 조회하므로, 수동 조회 직후 자동 조회가 실행되어도 이미 발송된 공고는 다시 보내지 않는다.

동시에 두 요청이 오래 겹치는 운영 상황이 생기면 DB 기반 실행 잠금 또는 배포 플랫폼의 동시 실행 제한을 추가로 검토한다.

## Slack 쓰레드 답변

Slack Bot 기반 답변을 쓰려면 Incoming Webhook 대신 또는 함께 아래 값을 설정한다.

- `SLACK_BOT_TOKEN`: `chat.postMessage` 권한이 있는 Bot User OAuth Token
- `SLACK_CHANNEL_ID`: 후보 공고 묶음 알림을 보낼 채널 ID
- `SLACK_SIGNING_SECRET`: Slack Events API 요청 서명 검증용 Secret

Slack App의 Event Subscriptions Request URL은 `https://<APP_BASE_URL>/api/slack/events`로 설정한다. 사용자가 묶음 알림 쓰레드에 `3번 공고는 왜 적합도가 12점이야?`처럼 질문하면, 서버는 해당 Slack 묶음 알림의 3번째 공고를 찾아 짧게 답하고 웹 상세 링크를 함께 보낸다.

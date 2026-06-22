#!/usr/bin/env python3
"""나라장터 표준 API 공고 조회 단일 스크립트.

원본(bluemap-notices) sync 디폴트와 동일:
    - lookback 2일 (SYNC_LOOKBACK_DAYS, 기본 2)
    - 최대 3페이지 (SYNC_MAX_PAGES, 기본 3)

사용 예:
    python get_sources.py --key <시리얼키>
    python get_sources.py --key <시리얼키> --lookback-days 3 --max-pages 5
    G2B_SERVICE_KEY=<시리얼키> python get_sources.py
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from urllib.parse import urlencode, quote

import requests

DEFAULT_BASE_URL = "http://apis.data.go.kr/1230000/ao/PubDataOpnStdService"

# 원본 sync 디폴트
DEFAULT_LOOKBACK_DAYS = 2
DEFAULT_MAX_PAGES = 3
DEFAULT_NUM_OF_ROWS = 100  # SYNC_NUM_OF_ROWS 확인 후 맞출 것


def format_g2b_datetime(dt: datetime, end_of_day: bool = False) -> str:
    if end_of_day:
        dt = dt.replace(hour=23, minute=59)
    return dt.strftime("%Y%m%d%H%M")


def normalize_service_key(key: str) -> str:
    """디코딩 키면 인코딩, 이미 인코딩된 키면 그대로."""
    if "%" in key:
        return key
    return quote(key, safe="")


def fetch_g2b_page(
    *,
    page_no: int,
    num_of_rows: int,
    start_date: datetime,
    end_date: datetime,
    service_key: str,
    base_url: str = DEFAULT_BASE_URL,
) -> list[dict]:
    search_params = urlencode({
        "numOfRows": num_of_rows,
        "pageNo": page_no,
        "type": "json",
        "bidNtceBgnDt": format_g2b_datetime(start_date),
        "bidNtceEndDt": format_g2b_datetime(end_date, end_of_day=True),
    })

    url = (
        f"{base_url}/getDataSetOpnStdBidPblancInfo"
        f"?{search_params}&ServiceKey={normalize_service_key(service_key)}"
    )

    response = requests.get(url, headers={"Accept": "application/json"}, timeout=30)

    if not response.ok:
        raise RuntimeError(f"나라장터 API 호출 실패: HTTP {response.status_code}")

    payload = response.json()
    header = payload.get("response", {}).get("header", {})
    result_code = header.get("resultCode")
    result_msg = header.get("resultMsg")

    if result_code and result_code != "00":
        raise RuntimeError(f"나라장터 API 오류: {result_code} {result_msg or ''}".strip())

    items = payload.get("response", {}).get("body", {}).get("items")
    if not items:
        return []
    if isinstance(items, dict):
        return [items]
    return items


def fetch_all_pages(
    *,
    max_pages: int,
    num_of_rows: int,
    start_date: datetime,
    end_date: datetime,
    service_key: str,
    base_url: str = DEFAULT_BASE_URL,
) -> list[dict]:
    """원본 sync 처럼 1페이지부터 max_pages까지 순회. 빈 페이지면 조기 종료."""
    collected: list[dict] = []
    for page_no in range(1, max_pages + 1):
        items = fetch_g2b_page(
            page_no=page_no,
            num_of_rows=num_of_rows,
            start_date=start_date,
            end_date=end_date,
            service_key=service_key,
            base_url=base_url,
        )
        if not items:
            break
        collected.extend(items)
        # 받은 행 수가 요청 행 수보다 적으면 마지막 페이지로 판단
        if len(items) < num_of_rows:
            break
    return collected


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="나라장터 표준 API 공고 조회")
    parser.add_argument(
        "--key",
        default=os.environ.get("G2B_SERVICE_KEY"),
        help="서비스 시리얼키 (없으면 환경변수 G2B_SERVICE_KEY 사용)",
    )
    parser.add_argument("--lookback-days", type=int, default=DEFAULT_LOOKBACK_DAYS,
                        help=f"오늘 기준 조회할 일수 (기본 {DEFAULT_LOOKBACK_DAYS})")
    parser.add_argument("--max-pages", type=int, default=DEFAULT_MAX_PAGES,
                        help=f"최대 페이지 수 (기본 {DEFAULT_MAX_PAGES})")
    parser.add_argument("--rows", type=int, default=DEFAULT_NUM_OF_ROWS,
                        help=f"페이지당 행 수 (기본 {DEFAULT_NUM_OF_ROWS})")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="API base URL")
    parser.add_argument("--raw", action="store_true", help="원본 JSON 그대로 출력")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)

    if not args.key:
        print("오류: 시리얼키가 없음. --key 또는 환경변수 G2B_SERVICE_KEY 사용", file=sys.stderr)
        return 1

    end_date = datetime.now()
    start_date = end_date - timedelta(days=args.lookback_days)

    try:
        items = fetch_all_pages(
            max_pages=args.max_pages,
            num_of_rows=args.rows,
            start_date=start_date,
            end_date=end_date,
            service_key=args.key,
            base_url=args.base_url,
        )
    except (RuntimeError, requests.RequestException) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1

    if args.raw:
        print(json.dumps(items, ensure_ascii=False, indent=2))
        return 0

    print(f"조회 결과 {len(items)}건 "
          f"(범위 {start_date:%Y-%m-%d} ~ {end_date:%Y-%m-%d}, 최대 {args.max_pages}페이지)")
    for i, item in enumerate(items, 1):
        title = item.get("bidNtceNm", "(제목 없음)")
        org = item.get("ntceInsttNm", "(기관 미확인)")
        no = item.get("bidNtceNo", "")
        print(f"{i}. [{no}] {title} / {org}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
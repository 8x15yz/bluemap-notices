import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichG2bNoticeWithDetail, fetchG2bBidDetail, g2bSource, type G2bBidNotice } from "@/lib/api/g2b";

describe("g2b source", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("normalizes a G2B bid notice", () => {
    const raw: G2bBidNotice = {
      bidNtceNo: "R25BK00933743",
      bidNtceOrd: "000",
      bidNtceNm: "해양공간정보 GIS 플랫폼 고도화 용역",
      bidNtceDate: "2026-06-10",
      bidNtceBgn: "09:00",
      bidClseDate: "2026-06-20",
      bidClseTm: "15:00",
      dmndInsttNm: "해양수산부",
      bsnsDivNm: "용역",
      asignBdgtAmt: "120000000",
      bidNtceUrl: "https://www.g2b.go.kr/link/example"
    };

    const notice = g2bSource.normalize(raw);

    expect(notice.sourceId).toBe("g2b");
    expect(notice.externalId).toBe("R25BK00933743-000");
    expect(notice.category).toBe("bid");
    expect(notice.organization).toBe("해양수산부");
    expect(notice.budgetAmount).toBe(120000000);
    expect(notice.matchedKeywords).toEqual(expect.arrayContaining(["해양", "해양공간정보", "GIS", "플랫폼"]));
    expect(notice.score).toBeGreaterThan(0);
  });

  it("fetches bid public detail information and extracts attachments", async () => {
    vi.stubEnv("G2B_SERVICE_KEY", "test-service-key");
    vi.stubEnv("G2B_BID_PUBLIC_API_BASE_URL", "https://api.example.test/BidPublicInfoService");
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          response: {
            header: {
              resultCode: "00",
              resultMsg: "NORMAL SERVICE"
            },
            body: {
              items: [
                {
                  bidNtceNo: "R26BK01578635",
                  bidNtceOrd: "000",
                  bidNtceDtlUrl: "https://www.g2b.go.kr/link/detail",
                  ntceSpecFileNm1: "공고서.pdf",
                  ntceSpecDocUrl1: "https://www.g2b.go.kr/file/1",
                  ntceSpecFileNm2: "제안요청서.hwpx",
                  ntceSpecDocUrl2: "https://www.g2b.go.kr/file/2",
                  cntrctCnclsMthdNm: "제한경쟁",
                  sucsfbidMthdNm: "협상에의한계약",
                  prtcptPsblRgnNm: "전국",
                  bidprcPsblIndstrytyNm: "소프트웨어사업자",
                  asignBdgtAmt: "102000000",
                  presmptPrce: "92727272"
                }
              ]
            }
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await fetchG2bBidDetail({
      bidNtceNo: "R26BK01578635",
      bidNtceOrd: "000",
      businessDivision: "일반용역"
    });

    const firstFetchUrl = String(((fetchMock.mock.calls as unknown) as Array<[unknown]>)[0]?.[0]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstFetchUrl).toContain("getBidPblancListInfoServc");
    expect(detail?.operation).toBe("getBidPblancListInfoServc");
    expect(detail?.attachments).toHaveLength(2);
    expect(detail?.attachments[0]).toMatchObject({
      name: "공고서.pdf",
      url: "https://www.g2b.go.kr/file/1"
    });
    expect(detail?.contractMethod).toBe("제한경쟁");
    expect(detail?.awardMethod).toBe("협상에의한계약");
    expect(detail?.assignedBudget).toBe(102000000);
  });

  it("falls back to the legacy ad base URL when another bid public base fails", async () => {
    vi.stubEnv("G2B_SERVICE_KEY", "test-service-key");
    vi.stubEnv("G2B_BID_PUBLIC_API_BASE_URL", "https://api.example.test/BidPublicInfoService");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Unexpected errors", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: {
                items: [
                  {
                    bidNtceNo: "R26BK01584057",
                    bidNtceOrd: "000",
                    cntrctCnclsMthdNm: "수의계약",
                    sucsfbidMthdNm: "소액수의견적"
                  }
                ]
              }
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await fetchG2bBidDetail({
      bidNtceNo: "R26BK01584057",
      bidNtceOrd: "000",
      businessDivision: "공사"
    });
    const secondFetchUrl = String(((fetchMock.mock.calls as unknown) as Array<[unknown]>)[1]?.[0]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(secondFetchUrl).toContain("/ad/BidPublicInfoService/getBidPblancListInfoCnstwk");
    expect(detail?.contractMethod).toBe("수의계약");
    expect(detail?.awardMethod).toBe("소액수의견적");
  });

  it("merges bid public detail metadata into candidate notices without changing score", async () => {
    vi.stubEnv("G2B_SERVICE_KEY", "test-service-key");
    vi.stubEnv("G2B_BID_PUBLIC_API_BASE_URL", "https://api.example.test/BidPublicInfoService");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: {
                items: [
                  {
                    bidNtceNo: "R26BK01578635",
                    bidNtceOrd: "000",
                    dmndInsttNm: "경상남도 창원시",
                    bidNtceDtlUrl: "https://www.g2b.go.kr/link/detail",
                    ntceSpecFileNm1: "제안요청서.hwpx",
                    ntceSpecDocUrl1: "https://www.g2b.go.kr/file/1",
                    cntrctCnclsMthdNm: "제한경쟁",
                    sucsfbidMthdNm: "협상에의한계약",
                    prtcptPsblRgnNm: "경상남도",
                    bidprcPsblIndstrytyNm: "소프트웨어사업자",
                    asignBdgtAmt: "102000000"
                  }
                ]
              }
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const notice = g2bSource.normalize({
      bidNtceNo: "R26BK01578635",
      bidNtceOrd: "000",
      bidNtceNm: "해양공간정보 GIS 플랫폼 고도화 용역",
      dmndInsttNm: "해양수산부",
      bsnsDivNm: "용역",
      bidClseDate: "2026-06-20",
      bidClseTm: "15:00"
    });
    const enriched = await enrichG2bNoticeWithDetail(notice);

    expect(enriched.score).toBe(notice.score);
    expect(enriched.organization).toBe("경상남도 창원시");
    expect(enriched.url).toBe("https://www.g2b.go.kr/link/detail");
    expect(enriched.budgetAmount).toBe(102000000);
    expect(enriched.metadata.contractMethod).toBe("제한경쟁");
    expect(enriched.metadata.winnerMethod).toBe("협상에의한계약");
    expect(enriched.metadata.possibleRegions).toBe("경상남도");
    expect(enriched.metadata.detail).toMatchObject({
      sourceService: "BidPublicInfoService",
      operation: "getBidPblancListInfoServc"
    });
  });
});

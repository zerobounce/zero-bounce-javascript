/**
 * @jest-environment node
 */
import { ZeroBounceSDK } from "../src/zero-bounce.js";

describe("getFile in Node.js", () => {
  const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";
  let zeroBounceSDK;

  beforeEach(() => {
    zeroBounceSDK = new ZeroBounceSDK();
    zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns CSV body as string instead of triggering a browser download", async () => {
    const csvBody = '"Email Address"\n"valid@example.com"\n';
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "text/csv" },
        text: () => Promise.resolve(csvBody),
      })
    );

    const response = await zeroBounceSDK.getFile(fileId);
    expect(response).toBe(csvBody);
  });

  it("returns scoring CSV body as string in Node.js", async () => {
    const csvBody = '"Score"\n"100"\n';
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "text/csv" },
        text: () => Promise.resolve(csvBody),
      })
    );

    const response = await zeroBounceSDK.getScoringFile(fileId);
    expect(response).toBe(csvBody);
  });

  it("returns parsed JSON when getfile body is an API error (HTTP 200)", async () => {
    const errPayload = { success: false, message: "File not ready" };
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: () => Promise.resolve(JSON.stringify(errPayload)),
      })
    );

    const response = await zeroBounceSDK.getFile(fileId);
    expect(response).toEqual(errPayload);
  });
});

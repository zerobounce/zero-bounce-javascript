import { ZeroBounceSDK, ZBValidateSubStatus } from "../src/zero-bounce.js";
import * as utils from "../src/utils.js";
import 'whatwg-fetch'

describe("ZeroBounceSDK", () => {
  let zeroBounceSDK;
  const initErrorMessage = "ZeroBounce: Call init function first with a valid api key.";
  const missingParamMessage = "parameter is missing";

  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    zeroBounceSDK = new ZeroBounceSDK();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("getFileJsonIndicatesFailure", () => {
    it("returns true for boolean success false", () => {
      expect(utils.getFileJsonIndicatesFailure({ success: false, message: "" })).toBe(true);
    });
    it("returns true for string success False", () => {
      expect(utils.getFileJsonIndicatesFailure({ success: "False", message: "" })).toBe(true);
    });
    it("returns true for non-empty message", () => {
      expect(utils.getFileJsonIndicatesFailure({ success: true, message: "err" })).toBe(true);
    });
    it("returns false for unrelated object", () => {
      expect(utils.getFileJsonIndicatesFailure({ file_id: "x" })).toBe(false);
    });
  });

  describe("init security", () => {
    it("rejects a non-https apiBaseURL", () => {
      expect(() => zeroBounceSDK.init("valid-api-key", "http://evil.example/v2")).toThrow(
        "apiBaseURL must be an https:// URL"
      );
    });
  });

  describe("getCredits", () => {
    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.getCredits()).rejects.toThrow(initErrorMessage);
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.getCredits();
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the correct number of credits", async () => {
      const expectedResponse = {
        "Credits": "100"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.getCredits();
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getApiUsage", () => {
    const startDate = "2018-01-01";
    const endDate = "2023-12-12";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.getApiUsage(startDate, endDate)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if stardDate is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.getApiUsage(null, endDate)).rejects.toThrow(missingParamMessage)
    });

    it("should throw an error if endDate is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.getApiUsage(startDate, null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.getApiUsage(startDate, endDate);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return API usage data", async () => {
      const expectedResponse = {
        "total": 5,
        "status_valid": 4,
        "status_invalid": 1,
        "status_catch_all": 0,
        "status_do_not_mail": 0,
        "status_spamtrap": 0,
        "status_unknown": 0,
        "sub_status_toxic": 0,
        "sub_status_disposable": 0,
        "sub_status_role_based": 0,
        "sub_status_possible_trap": 0,
        "sub_status_global_suppression": 0,
        "sub_status_timeout_exceeded": 0,
        "sub_status_mail_server_temporary_error": 0,
        "sub_status_mail_server_did_not_respond": 0,
        "sub_status_greylisted": 0,
        "sub_status_antispam_system": 0,
        "sub_status_does_not_accept_mail": 0,
        "sub_status_exception_occurred": 0,
        "sub_status_failed_syntax_check": 1,
        "sub_status_mailbox_not_found": 0,
        "sub_status_unroutable_ip_address": 0,
        "sub_status_possible_typo": 0,
        "sub_status_no_dns_entries": 0,
        "sub_status_role_based_catch_all": 0,
        "sub_status_mailbox_quota_exceeded": 0,
        "sub_status_forcible_disconnect": 0,
        "sub_status_failed_smtp_connection": 0,
        "sub_status_accept_all": 0,
        "sub_status_mx_forward": 0,
        "sub_status_alternate": 0,
        "sub_status_allowed": 0,
        "sub_status_blocked": 0,
        "sub_status_gold": 0,
        "sub_status_role_based_accept_all": 0,
        "start_date": "1/1/2018",
        "end_date": "12/12/2023"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.getApiUsage(startDate, endDate);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("validateEmail", () => {
    const email = "valid@example.com";
    const ip_address = "127.0.0.1";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.validateEmail(email, ip_address)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if email is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.validateEmail(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.validateEmail(email, ip_address);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the validated email data", async () => {
      const expectedResponse = {
        "address": "valid@example.com",
        "status": "valid",
        "sub_status": "",
        "free_email": false,
        "did_you_mean": null,
        "account": null,
        "domain": null,
        "domain_age_days": "9692",
        "smtp_provider": "example",
        "catchall_domain": false,
        "mx_found": "true",
        "mx_record": "mx.example.com",
        "firstname": "zero",
        "lastname": "bounce",
        "gender": "male",
        "country": null,
        "region": null,
        "city": null,
        "zipcode": null,
        "processed_at": "2023-04-27 13:47:23.980"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.validateEmail(email, ip_address);
      expect(response).toEqual(expectedResponse);
    });

    it("returns ai_agent_mailbox under the valid status", async () => {
      const expectedResponse = {
        address: "agent@example.com",
        status: "valid",
        sub_status: "ai_agent_mailbox",
      };

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.validateEmail("agent@example.com");
      expect(response.status).toEqual("valid");
      expect(response.sub_status).toEqual(ZBValidateSubStatus.AI_AGENT_MAILBOX);
    });

    it("returns ai_agent_mailbox under the catch-all status", async () => {
      const expectedResponse = {
        address: "agent@example.com",
        status: "catch-all",
        sub_status: "ai_agent_mailbox",
      };

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.validateEmail("agent@example.com");
      expect(response.status).toEqual("catch-all");
      expect(response.sub_status).toEqual(ZBValidateSubStatus.AI_AGENT_MAILBOX);
    });

    it("passes an unknown sub_status through untouched", async () => {
      // sub_status is forwarded as a raw string, so a value the SDK has never
      // heard of must survive rather than being dropped or throwing.
      const expectedResponse = {
        address: "future@example.com",
        status: "valid",
        sub_status: "some_future_sub_status",
      };

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.validateEmail("future@example.com");
      expect(response.sub_status).toEqual("some_future_sub_status");
    });

    it("should pass options object to the API", async () => {
      const expectedResponse = {
        "address": "valid@example.com",
        "status": "valid",
        "sub_status": "",
        "free_email": false,
        "did_you_mean": null,
        "account": null,
        "domain": null,
        "domain_age_days": "9692",
        "smtp_provider": "example",
        "catchall_domain": false,
        "mx_found": "true",
        "mx_record": "mx.example.com",
        "firstname": "zero",
        "lastname": "bounce",
        "gender": "male",
        "country": null,
        "region": null,
        "city": null,
        "zipcode": null,
        "processed_at": "2023-04-27 13:47:23.980"
      }

      const fetchSpy = jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await zeroBounceSDK.validateEmail(email, { ip_address: ip_address, timeout: 10 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("ip_address=127.0.0.1"),
        expect.any(Object)
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("timeout=10"),
        expect.any(Object)
      );
    });

    it("should pass timeout only via options object", async () => {
      const expectedResponse = {
        "address": "valid@example.com",
        "status": "valid",
        "sub_status": "",
      }

      const fetchSpy = jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await zeroBounceSDK.validateEmail(email, { timeout: 30 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("timeout=30"),
        expect.any(Object)
      );
    });

    it("should throw an error if timeout is less than 3", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.validateEmail(email, { timeout: 2 })).rejects.toThrow("timeout parameter is invalid")
    });

    it("should throw an error if timeout is greater than 60", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.validateEmail(email, { timeout: 61 })).rejects.toThrow("timeout parameter is invalid")
    });

    it("should pass activity_data and verify_plus via options object", async () => {
      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve({ status: "valid" }),
        text: () => Promise.resolve('{"status":"valid"}'),
      }));
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await zeroBounceSDK.validateEmail(email, {
        activityData: true,
        verifyPlus: false,
      });
      const calledUrl = String(fetch.mock.calls[0][0]);
      expect(calledUrl).toContain("activity_data=true");
      expect(calledUrl).toContain("verify_plus=false");
    });

    it("should send POST with form body when method is POST", async () => {
      const expectedResponse = { status: "valid", address: email };

      jest.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
        expect(String(url)).toContain("/validate");
        expect(String(url)).not.toContain("api_key=");
        expect(init.method).toBe("POST");
        expect(init.body).toBeInstanceOf(URLSearchParams);
        expect(init.body.get("email")).toBe(email);
        expect(init.body.get("api_key")).toBe("valid-api-key");
        expect(init.body.get("ip_address")).toBe(ip_address);
        return Promise.resolve({
          json: () => Promise.resolve(expectedResponse),
          text: () => Promise.resolve(JSON.stringify(expectedResponse)),
        });
      });

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.validateEmail(email, {
        ip_address,
        method: "POST",
      });
      expect(response).toEqual(expectedResponse);
    });
  });

  describe("scoreEmail", () => {
    const email = "mark@gmail.com";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.scoreEmail(email)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if email is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.scoreEmail(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return scoring data via GET", async () => {
      const expectedResponse = {
        email: "mark@gmail.com",
        score: 10,
      };

      jest.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
        expect(String(url)).toContain("/scoring?");
        expect(init.method).toBe("GET");
        return Promise.resolve({
          json: () => Promise.resolve(expectedResponse),
          text: () => Promise.resolve(JSON.stringify(expectedResponse)),
        });
      });

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.scoreEmail(email);
      expect(response).toEqual(expectedResponse);
    });

    it("should send POST with form body when requested", async () => {
      const expectedResponse = {
        email: "mark@gmail.com",
        score: 10,
      };

      jest.spyOn(global, "fetch").mockImplementationOnce((url, init) => {
        expect(String(url)).toContain("/scoring");
        expect(String(url)).not.toContain("api_key=");
        expect(init.method).toBe("POST");
        expect(init.body).toBeInstanceOf(URLSearchParams);
        expect(init.body.get("email")).toBe(email);
        expect(init.body.get("api_key")).toBe("valid-api-key");
        return Promise.resolve({
          json: () => Promise.resolve(expectedResponse),
          text: () => Promise.resolve(JSON.stringify(expectedResponse)),
        });
      });

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.scoreEmail(email, { method: "POST" });
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("validateBatch", () => {
    const emailBatch = [
      { email_address: "valid@example.com" },
      { email_address: "invalid@example.com" },
    ];

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.validateBatch(emailBatch)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if email list is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.validateBatch(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      const body = {
        email_batch: [],
        errors: [{ email_address: "all", error: "Invalid API Key or your account ran out of credits" }],
      };
      jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: { get: () => "application/json" },
          text: () => Promise.resolve(JSON.stringify(body)),
          json: () => Promise.resolve(body),
        })
      );
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.validateBatch(emailBatch)).rejects.toThrow(
        "Invalid API Key or your account ran out of credits"
      );
    });

    it("should return the validated emails data", async () => {
      const expectedResponse = {
        "email_batch": [
            {
                "address": "valid@example.com",
                "status": "valid",
                "sub_status": "",
                "free_email": false,
                "did_you_mean": null,
                "account": null,
                "domain": null,
                "domain_age_days": "9692",
                "smtp_provider": "example",
                "mx_found": "true",
                "mx_record": "mx.example.com",
                "firstname": "zero",
                "lastname": "bounce",
                "gender": "male",
                "country": null,
                "region": null,
                "city": null,
                "zipcode": null,
                "processed_at": "2023-04-27 14:15:15.450"
            },
            {
                "address": "invalid@example.com",
                "status": "invalid",
                "sub_status": "mailbox_not_found",
                "free_email": false,
                "did_you_mean": null,
                "account": null,
                "domain": null,
                "domain_age_days": "9692",
                "smtp_provider": "example",
                "mx_found": "true",
                "mx_record": "mx.example.com",
                "firstname": "zero",
                "lastname": "bounce",
                "gender": "male",
                "country": null,
                "region": null,
                "city": null,
                "zipcode": null,
                "processed_at": "2023-04-27 14:15:15.450"
            }
        ],
        "errors": []
      }

      jest.spyOn(global, "fetch").mockImplementationOnce((url) => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.validateBatch(emailBatch);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.zerobounce.net/v2/validatebatch"),
        expect.any(Object)
      );
      expect(String(fetch.mock.calls[0][0])).not.toContain("bulkapi");
      expect(response).toEqual(expectedResponse);
    });

    it("should include batch options in POST body", async () => {
      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve({ email_batch: [], errors: [] }),
        text: () => Promise.resolve('{"email_batch":[],"errors":[]}'),
      }));
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await zeroBounceSDK.validateBatch(emailBatch, {
        timeout: 60,
        activityData: true,
        verifyPlus: true,
      });
      const init = fetch.mock.calls[0][1];
      const body = JSON.parse(init.body);
      // LIVE: the API requires timeout as a JSON string; a number makes it
      // reject the whole batch with the account-level credits error.
      expect(body.timeout).toBe("60");
      expect(body.activity_data).toBe(true);
      expect(body.verify_plus).toBe(true);
    });

    it("should throw an error if batch timeout is out of range", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.validateBatch(emailBatch, { timeout: 9 })).rejects.toThrow("timeout parameter is invalid")
    });
  });


  describe("getEmailActivity", () => {
    const email = "valid@example.com";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.getEmailActivity(email)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if email is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.getEmailActivity(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.getEmailActivity(email);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the email activity data", async () => {
      const expectedResponse = {
        "found": true,
        "active_in_days": "180"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.getEmailActivity(email);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("sendFile", () => {
    class File {}
    var file = new File();

    const payload = {
      file: file,
      email_address_column: 1,
    };

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.sendFile(payload)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if file is missing", async () => {
      const payload = {
        email_address_column: 1,
      };

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.sendFile(payload)).rejects.toThrow(missingParamMessage)
    });

    it("should throw an error if email address column is missing", async () => {
      const payload = {
        file: file,
      };

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.sendFile(payload)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      const expected = {
        success: "False",
        message: ["api_key is invalid"],
      };
      jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: { get: () => "application/json" },
          text: () => Promise.resolve(JSON.stringify(expected)),
          json: () => Promise.resolve(expected),
        })
      );
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      // {"success": false} on an HTTP 200 is a failure, not a result.
      await expect(zeroBounceSDK.sendFile(payload)).rejects.toThrow("api_key is invalid");
    });

    it("should return the data regarding sent file", async () => {
      const expectedResponse = {
        "success": true,
        "message": "File Accepted",
        "file_name": "Your file name.csv",
        "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.sendFile(payload);
      expect(response).toEqual(expectedResponse);
    });

    it("should append allow_phase_2 when allowPhase2 is set", async () => {
      let capturedBody;
      jest.spyOn(global, "fetch").mockImplementationOnce((_url, init) => {
        capturedBody = init.body;
        return Promise.resolve({
          json: () => Promise.resolve({ success: true }),
          text: () => Promise.resolve("{}"),
        });
      });
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await zeroBounceSDK.sendFile({ ...payload, allowPhase2: true });
      expect(capturedBody.get("allow_phase_2")).toBe("true");
    });
  });


  describe("sendScoringFile", () => {
    class File {}
    var file = new File();

    const payload = {
      file: file,
      email_address_column: 1,
    };

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.sendScoringFile(payload)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if file is missing", async () => {
      const payload = {
        email_address_column: 1,
      };

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.sendScoringFile(payload)).rejects.toThrow(missingParamMessage)
    });

    it("should throw an error if email address column is missing", async () => {
      const payload = {
        file: file,
      };

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.sendScoringFile(payload)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      const expected = {
        success: "False",
        message: ["api_key is invalid"],
      };
      jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: { get: () => "application/json" },
          text: () => Promise.resolve(JSON.stringify(expected)),
          json: () => Promise.resolve(expected),
        })
      );
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      // {"success": false} on an HTTP 200 is a failure, not a result.
      await expect(zeroBounceSDK.sendScoringFile(payload)).rejects.toThrow("api_key is invalid");
    });

    it("should return the data regarding sent scoring file", async () => {
      const expectedResponse = {
        "success": true,
        "message": "File Accepted",
        "file_name": "Your file name.csv",
        "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.sendScoringFile(payload);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getFileStatus", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.getFileStatus(fileId)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.getFileStatus(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.getFileStatus(fileId);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the completion status of a previously sent file", async () => {
      const expectedResponse = {
        "success": true,
        "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff",
        "file_name": "email_file.csv",
        "upload_date": "2023-04-21T06:50:18Z",
        "file_status": "Complete",
        "file_phase_2_status": "N/A",
        "complete_percentage": "100%",
        "error_reason": null,
        "return_url": "Your return URL if provided when calling sendfile API"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.getFileStatus(fileId);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getScoringFileStatus", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.getScoringFileStatus(fileId)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.getScoringFileStatus(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.getScoringFileStatus(fileId);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the completion status of a previously sent scoring file", async () => {
      const expectedResponse = {
        "success": true,
        "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff",
        "file_name": "email_file.csv",
        "upload_date": "2023-04-21T06:50:18Z",
        "file_status": "Complete",
        "complete_percentage": "100%",
        "return_url": "Your return URL if provided when calling sendfile API"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.getScoringFileStatus(fileId);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getFile", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    afterEach(() => {
      jest.restoreAllMocks();
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.getFile(fileId)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.getFile(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.getFile(fileId);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the previously sent file", async () => {
      const expectedResponse = "\"Email Address\"\n\"valid@example.com\"\n";

      const createRequestSpy = jest.spyOn(utils, "createRequest").mockImplementationOnce(() => {
        return Promise.resolve(expectedResponse);
      });

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.getFile(fileId);
      expect(createRequestSpy.mock.calls[0][0]["returnText"]).toEqual(true);
      expect(response).toEqual(expectedResponse);
    });

    it("should pass download_type and activity_data for validation getfile", async () => {
      const createRequestSpy = jest.spyOn(utils, "createRequest").mockImplementationOnce(() =>
        Promise.resolve("ok")
      );
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await zeroBounceSDK.getFile(fileId, {
        downloadType: ZeroBounceSDK.ZBDownloadType.COMBINED,
        activityData: true,
      });
      const arg = createRequestSpy.mock.calls[0][0];
      expect(arg.params.download_type).toBe("combined");
      expect(arg.params.activity_data).toBe("true");
    });

    it("should not pass activity_data for scoring getfile", async () => {
      const createRequestSpy = jest.spyOn(utils, "createRequest").mockImplementationOnce(() =>
        Promise.resolve("ok")
      );
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await zeroBounceSDK.getScoringFile(fileId, {
        downloadType: ZeroBounceSDK.ZBDownloadType.PHASE_2,
        activityData: true,
      });
      const arg = createRequestSpy.mock.calls[0][0];
      expect(arg.params.download_type).toBe("phase_2");
      expect(arg.params.activity_data).toBeUndefined();
    });

    it("should return parsed JSON when getfile body is an API error (HTTP 200)", async () => {
      const errPayload = { success: false, message: "File not ready" };
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "" },
          text: () => Promise.resolve(JSON.stringify(errPayload)),
        })
      );
      const response = await zeroBounceSDK.getFile(fileId);
      expect(response).toEqual(errPayload);
    });

    it("should trigger browser download and return filename on success", async () => {
      const csvBody = '"Email Address"\n"valid@example.com"\n';
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "text/csv" },
          text: () => Promise.resolve(csvBody),
        })
      );
      const clickSpy = jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      const response = await zeroBounceSDK.getFile(fileId);

      expect(response).toBe("result.csv");
      expect(clickSpy).toHaveBeenCalled();
    });
  });


  describe("getScoringFile", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.getScoringFile(fileId)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.getScoringFile(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.getScoringFile(fileId);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the previously sent scoring file", async () => {
      const expectedResponse = "\"Score\"\n\"100\"\n";

      const createRequestSpy = jest.spyOn(utils, "createRequest").mockImplementationOnce(() => {
        return Promise.resolve(expectedResponse);
      });

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.getScoringFile(fileId);
      expect(createRequestSpy.mock.calls[0][0]["returnText"]).toEqual(true);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("deleteFile", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.deleteFile(fileId)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.deleteFile(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.deleteFile(fileId);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should delete previously sent file", async () => {
      const expectedResponse = {
        "success":true,
        "message":"File Deleted",
        "file_name":"email_file.csv",
        "file_id":"aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.deleteFile(fileId);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("deleteScoringFile", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.deleteScoringFile(fileId)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.deleteScoringFile(null)).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.deleteScoringFile(fileId);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should delete previously sent scoring file", async () => {
      const expectedResponse = {
        "success":true,
        "message":"File Deleted",
        "file_name":"email_file.csv",
        "file_id":"aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.deleteScoringFile(fileId);
      expect(response).toEqual(expectedResponse);
    });
  });

  // EMAIL FINDER
  describe("findEmail", () => {
    const payload = {
      domain: "example.com",
      first_name: "John",
      last_name: "Doe",
    }

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.findEmailByDomain(payload)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if domain is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.findEmailByDomain({domain: null})).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.findEmailByDomain(payload);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the validated format data", async () => {
      const expectedResponse = {
        "email": "john.doe@example.com",
        "email_confidence": "high",
        "domain": "",
        "company_name": "",
        "did_you_mean": "",
        "failure_reason": ""
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.findEmailByDomain(payload);
      expect(response).toEqual(expectedResponse);
    });
  });

  // DOMAIN SEARCH
  describe("findEmailFormat", () => {
    const payload = {
      domain: "example.com",
      first_name: "John",
      last_name: "Doe",
    }

    it("should throw an error if not initialized", async () => {
      await expect(zeroBounceSDK.findEmailFormatByDomain(payload)).rejects.toThrow(initErrorMessage);
    });

    it("should throw an error if domain is missing", async () => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      await expect(zeroBounceSDK.findEmailFormatByDomain({domain: null})).rejects.toThrow(missingParamMessage)
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      try {
        await zeroBounceSDK.findEmailFormatByDomain(payload);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the validated format data", async () => {
      const expectedResponse = {
        "domain": "",
        "company_name": "",
        "format": "first.last",
        "confidence": "high",
        "did_you_mean": "",
        "failure_reason": "",
        "other_domain_formats": []
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
      const response = await zeroBounceSDK.findEmailFormatByDomain(payload);
      expect(response).toEqual(expectedResponse);
    });
  });

  describe("Priority 3 bulk APIs", () => {
    class File {}
    const file = new File();

    const jsonOk = (data) =>
      Promise.resolve({
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
        ok: true,
        headers: { get: () => "application/json" },
      });

    beforeEach(() => {
      zeroBounceSDK.init("valid-api-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
    });

    it("sendEmailFinderFile targets bulkapi email-finder sendfile", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk({ success: true, file_id: "fid" })
      );
      await zeroBounceSDK.sendEmailFinderFile({ file, domain_column: 1 });
      expect(String(fetch.mock.calls[0][0])).toContain(
        "https://bulkapi.zerobounce.net/email-finder/sendfile"
      );
    });

    it("getDomainSearchFileStatus uses domain-search filestatus on bulk root", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk({ success: true, file_status: "Complete" })
      );
      await zeroBounceSDK.getDomainSearchFileStatus("file-123");
      expect(String(fetch.mock.calls[0][0])).toContain(
        "https://bulkapi.zerobounce.net/domain-search/filestatus"
      );
      expect(String(fetch.mock.calls[0][0])).toContain("file_id=file-123");
    });

    it("sendListEvaluatorFile posts to v2 listevaluator", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk({ file_id: "le-1" })
      );
      await zeroBounceSDK.sendListEvaluatorFile({ file, email_address_column: 2 });
      expect(String(fetch.mock.calls[0][0])).toBe(
        "https://bulkapi.zerobounce.net/v2/listevaluator/"
      );
    });

    it("getListEvaluatorResult GETs file id path on bulk v2", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk({ file_status: "Complete" })
      );
      await zeroBounceSDK.getListEvaluatorResult("abc-def");
      expect(String(fetch.mock.calls[0][0])).toContain(
        "https://bulkapi.zerobounce.net/v2/listevaluator/abc-def/"
      );
    });

    it("addFilter POSTs to main API filters/add", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk({ Message: "Filter successfully added" })
      );
      await zeroBounceSDK.addFilter({
        rule: "allow",
        target: "domain",
        value: "example.com",
      });
      const [url, init] = fetch.mock.calls[0];
      expect(String(url)).toContain("https://api.zerobounce.net/v2/filters/add");
      expect(init.method).toBe("POST");
    });

    it("listFilters supports POST method option", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk([])
      );
      await zeroBounceSDK.listFilters({ method: "POST" });
      const [url, init] = fetch.mock.calls[0];
      expect(String(url)).toContain("/filters/list");
      expect(init.method).toBe("POST");
    });

    it("listS3files GETs bulkapi listS3files with optional bucket and search", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk([{ name: "uploads/list.csv", size: 100, last_modified: "2024-01-01T00:00:00Z" }])
      );
      await zeroBounceSDK.listS3files({
        bucket: "my-bucket",
        search: "list",
      });
      const calledUrl = String(fetch.mock.calls[0][0]);
      expect(calledUrl).toBe(
        "https://bulkapi.zerobounce.net/listS3files?api_key=valid-api-key&bucket=my-bucket&search=list"
      );
      expect(fetch.mock.calls[0][1].method).toBe("GET");
    });

    it("validateS3file posts to bulkapi validateS3file", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk({ success: true, file_id: "s3-job" })
      );
      await zeroBounceSDK.validateS3file({
        file_name: "emails/list.csv",
        has_header_row: true,
        remove_duplicates: true,
      });
      expect(String(fetch.mock.calls[0][0])).toBe(
        "https://bulkapi.zerobounce.net/validateS3file"
      );
    });

    it("exportS3file posts file_id and export_bucket", async () => {
      const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
        jsonOk({ success: true })
      );
      await zeroBounceSDK.exportS3file({
        file_id: "job-1",
        export_bucket: "my-bucket",
      });
      const body = fetch.mock.calls[0][1].body;
      expect(body.get("file_id")).toBe("job-1");
      expect(body.get("export_bucket")).toBe("my-bucket");
    });
  });
});
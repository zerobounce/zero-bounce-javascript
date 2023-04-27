import { ZeroBounceSDK } from "../src/zero-bounce.js";
import * as utils from "../src/utils.js";

describe("ZeroBounceSDK", () => {
  let zeroBounceSDK;
  const initErrorMessage = "ZeroBounce: Call init function first with a valid api key.";
  const missingParamMessage = "parameter is missing";

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
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


  describe("getCredits", () => {
    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.getCredits();
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      const response = await zeroBounceSDK.getCredits();
      expect(response).toEqual({ "Credits": "-1" });
    });

    it("should return the correct number of credits", async () => {
      const expectedResponse = {
        "Credits": "100"
      }

      jest.spyOn(utils, "createRequest").mockImplementationOnce(() => {
        return Promise.resolve(expectedResponse);
      });

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.getCredits();
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getApiUsage", () => {
    const startDate = "2018-01-01";
    const endDate = "2023-12-12";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.getApiUsage(startDate, endDate);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if stardDate is missing", async () => {
      zeroBounceSDK.init("invalid-api-key");
      await zeroBounceSDK.getApiUsage(null, endDate);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should throw an error if endDate is missing", async () => {
      zeroBounceSDK.init("invalid-api-key");
      await zeroBounceSDK.getApiUsage(startDate, null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      const response = await zeroBounceSDK.getApiUsage(startDate, endDate);
      expect(response).toEqual({ "error": "Invalid API key" });
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
        "sub_status_mx_forward": 0,
        "sub_status_alternate": 0,
        "sub_status_blocked": 0,
        "sub_status_allowed": 0,
        "start_date": "1/1/2018",
        "end_date": "12/12/2023"
      }

      jest.spyOn(utils, "createRequest").mockImplementationOnce(() => {
        return Promise.resolve(expectedResponse);
      });

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.getApiUsage(startDate, endDate);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("validateEmail", () => {
    const email = "valid@example.com";
    const ip_address = "127.0.0.1";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.validateEmail(email, ip_address);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if email is missing", async () => {
      zeroBounceSDK.init("invalid-api-key");
      await zeroBounceSDK.validateEmail(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      const response = await zeroBounceSDK.validateEmail(email, ip_address);
      expect(response).toEqual({
        "error": "Invalid API key or your account ran out of credits"
      });
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

      jest.spyOn(utils, "createRequest").mockImplementationOnce(() => {
        return Promise.resolve(expectedResponse);
      });

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.validateEmail(email, ip_address);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("validateBatch", () => {
    const emailBatch = [
      { email_address: "valid@example.com" },
      { email_address: "invalid@example.com" },
    ];

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.validateBatch(emailBatch);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if email list is missing", async () => {
      zeroBounceSDK.init("invalid-api-key");
      await zeroBounceSDK.validateBatch(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      const response = await zeroBounceSDK.validateBatch(emailBatch);
      expect(response).toEqual({
        "email_batch": [],
        "errors": [
            {
                "email_address": "all",
                "error": "Invalid API Key or your account ran out of credits"
            }
        ]
      });
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

      jest.spyOn(utils, "createRequest").mockImplementationOnce(() => {
        return Promise.resolve(expectedResponse);
      });

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.validateBatch(emailBatch);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getEmailActivity", () => {
    const email = "valid@example.com";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.getEmailActivity(email);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if email is missing", async () => {
      zeroBounceSDK.init("invalid-api-key");
      await zeroBounceSDK.getEmailActivity(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      const response = await zeroBounceSDK.getEmailActivity(email);
      expect(response).toEqual({
        "error": "Invalid API key or your account ran out of credits"
      });
    });

    it("should return the email activity data", async () => {
      const expectedResponse = {
        "found": true,
        "active_in_days": "180"
      }

      jest.spyOn(utils, "createRequest").mockImplementationOnce(() => {
        return Promise.resolve(expectedResponse);
      });

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.getEmailActivity(email);
      expect(response).toEqual(expectedResponse);
    });
  });
});
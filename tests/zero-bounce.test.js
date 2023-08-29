import { ZeroBounceSDK } from "../src/zero-bounce.js";
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


  describe("getCredits", () => {
    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.getCredits();
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.getApiUsage(null, endDate);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should throw an error if endDate is missing", async () => {
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.getApiUsage(startDate, null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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
        "sub_status_mx_forward": 0,
        "sub_status_alternate": 0,
        "sub_status_blocked": 0,
        "sub_status_allowed": 0,
        "start_date": "1/1/2018",
        "end_date": "12/12/2023"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

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
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.validateEmail(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.validateBatch(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      try {
        await zeroBounceSDK.validateBatch(emailBatch);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
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

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

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
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.getEmailActivity(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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

      zeroBounceSDK.init("valid-api-key");
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
      await zeroBounceSDK.sendFile(payload);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if file is missing", async () => {
      const payload = {
        email_address_column: 1,
      };

      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.sendFile(payload);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should throw an error if email address column is missing", async () => {
      const payload = {
        file: file,
      };

      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.sendFile(payload);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      const response = await zeroBounceSDK.sendFile(payload);
      expect(response).toEqual({
        "success": "False",
        "message": [
            "api_key is invalid"
        ]
      });
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

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.sendFile(payload);
      expect(response).toEqual(expectedResponse);
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
      await zeroBounceSDK.sendScoringFile(payload);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if file is missing", async () => {
      const payload = {
        email_address_column: 1,
      };

      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.sendScoringFile(payload);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should throw an error if email address column is missing", async () => {
      const payload = {
        file: file,
      };

      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.sendScoringFile(payload);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      const response = await zeroBounceSDK.sendScoringFile(payload);
      expect(response).toEqual({
        "success": "False",
        "message": [
            "api_key is invalid"
        ]
      });
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

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.sendScoringFile(payload);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getFileStatus", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.getFileStatus(fileId);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.getFileStatus(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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
        "complete_percentage": "100%",
        "error_reason": null,
        "return_url": "Your return URL if provided when calling sendfile API"
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.getFileStatus(fileId);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getScoringFileStatus", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.getScoringFileStatus(fileId);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.getScoringFileStatus(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.getScoringFileStatus(fileId);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getFile", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.getFile(fileId);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.getFile(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.getFile(fileId);
      expect(createRequestSpy.mock.calls[0][0]["returnText"]).toEqual(true);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("getScoringFile", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.getScoringFile(fileId);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.getScoringFile(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.getScoringFile(fileId);
      expect(createRequestSpy.mock.calls[0][0]["returnText"]).toEqual(true);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("deleteFile", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.deleteFile(fileId);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.deleteFile(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.deleteFile(fileId);
      expect(response).toEqual(expectedResponse);
    });
  });


  describe("deleteScoringFile", () => {
    const fileId = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.deleteScoringFile(fileId);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if file id is missing", async () => {
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.deleteScoringFile(null);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
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

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.deleteScoringFile(fileId);
      expect(response).toEqual(expectedResponse);
    });
  });

  // EMAIL FINDER
  describe("guessFormat", () => {
    const payload = {
      domain: "example.com",
      first_name: "John",
      last_name: "Doe",
    }

    it("should throw an error if not initialized", async () => {
      await zeroBounceSDK.guessFormat(payload);
      expect(console.error).toHaveBeenCalledWith(initErrorMessage);
    });

    it("should throw an error if domain is missing", async () => {
      zeroBounceSDK.init("valid-api-key");
      await zeroBounceSDK.guessFormat({domain: null});
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(missingParamMessage)
      );
    });

    it("should return error response with invalid API key", async () => {
      zeroBounceSDK.init("invalid-api-key");
      try {
        await zeroBounceSDK.guessFormat(payload);
      } catch (error) {
        expect(error.message).toEqual('TypeError: Network request failed');
      }
    });

    it("should return the validated format data", async () => {
      const expectedResponse = {
        "email": "john.doe@example.com",
        "domain": "",
        "format": "first.last",
        "status": "valid",
        "sub_status": "",
        "confidence": "high",
        "did_you_mean": "",
        "failure_reason": "",
        "other_domain_formats": []
      }

      jest.spyOn(global, "fetch").mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(expectedResponse),
        text: () => Promise.resolve(JSON.stringify(expectedResponse)),
      }));

      zeroBounceSDK.init("valid-api-key");
      const response = await zeroBounceSDK.guessFormat(payload);
      expect(response).toEqual(expectedResponse);
    });
  });
});
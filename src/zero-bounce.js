import { createRequest, notInitialized, parameterIsMissing } from "./utils.js";

export class ZeroBounceSDK {
  constructor() {
    this._initialized = false;
    this._api_key = null;
  }

  /**
   * @param apiKey - your private API key
   * */
  init(apiKey) {
    if (!apiKey) {
      parameterIsMissing("Api key", "Please provide a valid API key.");
    } else {
      this._api_key = apiKey;
      this._initialized = true;
    }
  }

  getCredits() {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    const params = {
      api_key: this._api_key,
    };
    return createRequest({ requestType: "GET", params, path: "/getcredits" });
  }

  /**
   * @param email - email to be validated
   * @param ip_address
   * */
  validateEmail(email, ip_address = null) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!email) {
      parameterIsMissing("Email");
      return;
    }
    const params = {
      api_key: this._api_key,
      email: email,
      ip_address,
    };
    return createRequest({ requestType: "GET", params, path: "/validate" });
  }

  /**
   * @param startDate - The start date
   * @param endDate - The end date
   * */
  getApiUsage(startDate, endDate) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!startDate) {
      parameterIsMissing("Start date", "Format: YYYY-MM-DD");
      return;
    } else if (!endDate) {
      parameterIsMissing("End date", "Format: YYYY-MM-DD");
      return;
    }

    const params = {
      api_key: this._api_key,
      start_date: startDate,
      end_date: endDate,
    };
    return createRequest({
      requestType: "GET",
      params,
      path: "/getapiusage",
    });
  }

  /**
   * @param emailBatch: an array containing a list of email objects {email_address: "example@example.com"}
   * */

  validateBatch(emailBatch) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!emailBatch) {
      parameterIsMissing("Email list");
      return;
    }

    const body = {
      api_key: this._api_key,
      email_batch: emailBatch,
    };
    return createRequest({
      requestType: "POST",
      path: "/validatebatch",
      body: JSON.stringify(body),
      batch: true,
    });
  }

  /**
   * @param email - a valid email address
   * */
  getEmailActivity(email) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!email) {
      parameterIsMissing("Email");
      return;
    }
    const params = {
      api_key: this._api_key,
      email,
    };
    return createRequest({
      requestType: "GET",
      params,
      path: "/activity",
    });
  }

  /**
   * @param file: File - The csv or txt file to be submitted.
   * @param email_address_column: number - The column index of the email address in the file. Index starts from 1.
   * @param return_url: str or null - The URL will be used to call back when the validation is completed.
   * @param first_name_column: number or null - The column index of the first name column.
   * @param last_name_column: number or null - The column index of the last name column.
   * @param gender_column: number or null - The column index of the gender column.
   * @param ip_address_column: number or null - The IP Address the email signed up from.
   * @param has_header_row: Boolean - If the first row from the submitted file is a header row.
   * @param remove_duplicate: Boolean - If you want the system to remove duplicate emails.
   * */
  sendFile({
    file,
    email_address_column,
    first_name_column = false,
    return_url = false,
    last_name_column = false,
    gender_column = false,
    ip_address_column = false,
    has_header_row = false,
    remove_duplicate = false,
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!file) {
      parameterIsMissing("file");
      return;
    } else if (!email_address_column) {
      parameterIsMissing("email_address_column");
      return;
    }

    const body = new FormData();
    if (return_url) {
      body.append("return_url", return_url);
    }
    if (first_name_column) {
      body.append("first_name_column", first_name_column);
    }
    if (last_name_column) {
      body.append("last_name_column", last_name_column);
    }
    if (gender_column) {
      body.append("gender_column", gender_column);
    }
    if (ip_address_column) {
      body.append("ip_address_column", ip_address_column);
    }

    body.append("email_address_column", email_address_column);
    body.append("file", file);
    body.append("has_header_row", has_header_row);
    body.append("remove_duplicate", remove_duplicate);
    body.append("api_key", this._api_key);

    return createRequest({
      requestType: "POST",
      path: "/sendfile",
      body,
      batch: true,
    });
  }

  /**
   * @param file: File - The csv or txt file to be submitted.
   * @param email_address_column: number - The column index of the email address in the file. Index starts from 1.
   * @param return_url: str or null - The URL will be used to call back when the validation is completed.
   * @param has_header_row: Boolean - If the first row from the submitted file is a header row.
   * @param remove_duplicate: Boolean - If you want the system to remove duplicate emails.
   * */
  sendScoringFile({
    file,
    email_address_column,
    return_url = false,
    has_header_row = false,
    remove_duplicate = false,
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!file) {
      parameterIsMissing("file: File");
      return;
    } else if (!email_address_column) {
      parameterIsMissing("email_address_column: number");
      return;
    }

    const body = new FormData();

    if (return_url) {
      body.append("return_url", return_url);
    }

    body.append("file", file);
    body.append("email_address_column", email_address_column);
    body.append("has_header_row", has_header_row);
    body.append("api_key", this._api_key);
    body.append("remove_duplicate", remove_duplicate);

    return createRequest({
      requestType: "POST",
      path: "/scoring/sendfile",
      body,
      batch: true,
    });
  }

  _getStatusUtil(fileId, path) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!fileId) {
      parameterIsMissing("File id");
      return;
    }

    const params = {
      api_key: this._api_key,
      file_id: fileId,
    };
    return createRequest({
      requestType: "GET",
      params,
      path,
      batch: true,
    });
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  getFileStatus(fileId) {
    return this._getStatusUtil(fileId, "/filestatus");
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  getScoringFileStatus(fileId) {
    return this._getStatusUtil(fileId, "/scoring/filestatus");
  }

  _getFileUtil(fileId, path, scoring = false) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!fileId) {
      parameterIsMissing("File id");
      return;
    }
    const params = {
      api_key: this._api_key,
      file_id: fileId,
    };
    return createRequest({
      requestType: "GET",
      params,
      path,
      batch: true,
      returnText: true,
      scoring,
    });
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  getFile(fileId) {
    return this._getFileUtil(fileId, "/getfile");
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  getScoringFile(fileId) {
    return this._getFileUtil(fileId, "/scoring/getfile", true);
  }

  _deleteFileUtil(fileId, path, scoring = false) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!fileId) {
      parameterIsMissing("File id");
      return;
    }
    const params = {
      api_key: this._api_key,
      file_id: fileId,
    };
    return createRequest({
      requestType: "GET",
      params,
      path,
      batch: true,
      scoring,
    });
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  deleteFile(fileId) {
    return this._deleteFileUtil(fileId, "/deletefile");
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  deleteScoringFile(fileId) {
    return this._deleteFileUtil(fileId, "/scoring/deletefile", true);
  }

  // EMAIL FINDER

  /**
   * @param domain str - domain of the email address
   * @param first_name str or null - first name
   * @param middle_name str or null - middle name
   * @param last_name str or null - last name
   * */
  guessFormat ({
    domain, 
    first_name = null, 
    middle_name = null, 
    last_name = null
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!domain) {
      parameterIsMissing("domain");
      return;
    }

    const params = {
      api_key: this._api_key,
      domain: domain,
      first_name: first_name,
      middle_name: middle_name,
      last_name: last_name,
    };

    return createRequest({
      requestType: "GET",
      params,
      path: "/guessformat",
    });
  }
}

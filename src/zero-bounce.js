import {
    apiUsageEndpoint,
    getCreditsEndpoint,
    HEADERS,
    validateEndpoint,
  } from "./utils";
  
  export class ZeroBounceSDK {
    constructor() {
      this._initialized = false;
      /**
       * @param apiKey - your private API key
       * */
      this._api_key = null;
    }
  
    init(apiKey) {
      if (this._initialized) {
        console.log("ZeroBounce: Zero Bounce SDK has already been initialized.");
        return;
      } else if (!apiKey) {
        console.error(
          "ZeroBounce: Api key is missing. Please provide a valid API key."
        );
      } else {
        this._api_key = apiKey;
        this._initialized = true;
      }
    }
  
    async getCredits() {
      if (!this._initialized) {
        console.error(
          "ZeroBounce: Call init function first with a valid api key."
        );
        return;
      }
      const url = getCreditsEndpoint(this._api_key);
  
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: HEADERS,
        });
        const credits = await response.json();
  
        return credits;
      } catch (error) {
        throw new Error(error);
      }
    }
  
    async validateEmail(email, ip_address = null) {
      if (!this._initialized) {
        console.error(
          "ZeroBounce: Call init function first with a valid api key."
        );
        return;
      } else if (!email) {
        console.error("ZeroBounce: Please provide an email to be validated.");
        return;
      } else {
        const url = validateEndpoint(email, ip_address, this._api_key);
  
        try {
          const response = await fetch(url, {
            method: "GET",
            headers: HEADERS,
          });
          const validated = await response.json();
  
          return validated;
        } catch (error) {
          throw new Error(error);
        }
      }
    }
  
    async getApiUsage(startDate, endDate) {
      if (!this._initialized) {
        console.error(
          "ZeroBounce: Call init function first with a valid api key."
        );
        return;
      } else if (!startDate) {
        console.error(
          "ZeroBounce: Please provide a valid start date. Format: YYYY-MM-DD"
        );
        return;
      } else if (!endDate) {
        console.error(
          "ZeroBounce: Please provide a valid end date. Format: YYYY-MM-DD"
        );
        return;
      } else {
        const url = apiUsageEndpoint(startDate, endDate, this._api_key);
  
        try {
          const response = await fetch(url, {
            method: "GET",
            headers: HEADERS,
          });
          const apiUsage = await response.json();
  
          return apiUsage;
        } catch (error) {
          throw new Error(error);
        }
      }
    }
  }
  
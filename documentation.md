
WE DO NOT RECOMMEND USING THIS SDK ON A FRONT-END ENVIRONMENT AS THE API KEY WILL BE VISIBLE

#### INSTALLATION

```bash
npm install @zerobounce/zero-bounce-sdk
```

#### USAGE

Add the script

```HTML
<script src="<PATH_TO_SCRIPT/zeroBounceSDK.js"></script>
```

```HTML
<script>
const zeroBounce = new ZeroBounceSDK();
</script>
```

OR

Add npm module

```javascript
const ZeroBounceSDK = require('@zerobounce/zero-bounce-sdk')

const zeroBounce = new ZeroBounceSDK();
```

Initialize the sdk with your api key:

```javascript
zeroBounce.init("<YOUR_API_KEY>");
```

NOTE: all the methods are asynchronous they have to be used with async / await or .then.catch

#### Examples

Then you can use any of the SDK methods, for example:

- ####### Check how many credits you have left on your account

```javascript
try {
  const response = await zeroBounce.getCredits();
} catch (error) {
  console.error(error);
}
```

- ####### Validate an email address

```javascript
const email = "<EMAIL_ADDRESS>"; // The email address you want to validate
const ip_address = "127.0.0.1"; // The IP Address the email signed up from (Optional)

try {
  const response = await zeroBounce.validateEmail(email, ip_address);
} catch (error) {
  console.error(error);
}
```

- ####### Get api usage from a start date to an end date

```javascript
const startDate = "2018-01-01"; // The start date of when you want to view API usage
const endDate = "2023-12-12"; // The end date of when you want to view API usage

try {
  const response = await zeroBounce.getApiUsage(startDate, endDate);
} catch (error) {
  console.error(error);
}
```

- ####### Validate a list of emails

```javascript
const emailBatch = [
  { email_address: "<EMAIL_ADDRESS>" },
  { email_address: "<EMAIL_ADDRESS>" },
]; // an array containing a list of email objects {email_address: "example@example.com"}

try {
  const response = await zeroBounce.validateBatch(emailBatch);
} catch (error) {
  console.error(error);
}
```

- ####### Get data about an email activity

```javascript
const email = "<EMAIL_ADDRESS>"; // The email address you want to get the activity for

try {
  const response = await zeroBounce.getEmailActivity(email);
} catch (error) {
  console.error(error);
}
```

- ####### Send a csv file containing email addresses to be validated

```javascript
// Parameters
// ----------
// file: File
//     The csv or txt file to be submitted.
// email_address_column: number
//     The column index of the email address in the file. Index starts from 1.
// return_url: str or null (Optional)
//     The URL will be used to call back when the validation is completed.
// first_name_column: number or null (Optional)
//     The column index of the first name column.
// last_name_column: number or null (Optional)
//     The column index of the last name column.
// gender_column: number or null (Optional)
//     The column index of the gender column.
// ip_address_column: number or null (Optional)
//     The IP Address the email signed up from.
// has_header_row: Boolean (Optional)
//     If the first row from the submitted file is a header row.
// remove_duplicate: Boolean (Optional)
//     If you want the system to remove duplicate emails.
const payload = {
  file: "<FILE>",
  email_address_column: "<NUMBER_OF_COLUMN>", //example 3
  return_url: "<RETURN_URL>", // (Optional)
  first_name_column: "<NUMBER_OF_COLUMN>", //example 3 (Optional)
  last_name_column: "<NUMBER_OF_COLUMN>", //example 3 (Optional)
  gender_column: "<NUMBER_OF_COLUMN>", //example 3 (Optional)
  ip_address_column: "<NUMBER_OF_COLUMN>", //example 3 (Optional)
  has_header_row: true / false, // (Optional)
  remove_duplicate: true / false, // (Optional)
};

try {
  const response = await zeroBounce.sendFile(payload);
} catch (error) {
  console.error(error);
}
```

- ####### Send a csv file containing email addresses to get the scoring of the emails

```javascript
// Parameters
// ----------
// file: File
//     The csv or txt file to be submitted.
// email_address_column: number
//     The column index of the email address in the file. Index starts from 1.
// return_url: str or null (Optional)
//     The URL will be used to call back when the validation is completed.
// has_header_row: Boolean (Optional)
//     If the first row from the submitted file is a header row.
// remove_duplicate: Boolean (Optional)
//     If you want the system to remove duplicate emails.
const payload = {
  file: "<FILE>",
  email_address_column: "<NUMBER_OF_COLUMN>", //example 3
  return_url: "<RETURN_URL>", // (Optional)
  has_header_row: true / false,
  remove_duplicate: true / false, // (Optional)
};

try {
  const response = await zeroBounce.sendScoringFile(payload);
} catch (error) {
  console.error(error);
}
```

- ####### The completion status of a previously sent file

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.getFileStatus(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### The completion status of a previously sent scoring file

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.getScoringFileStatus(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Get the file with the validated data

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.getFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Get the file with the scoring data

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.getScoringFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Delete the file with the validated data

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.deleteFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Delete the file with the scoring data

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.deleteScoringFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Email finder - Test a variety of patterns and combinations in real time until it identifies a valid business email.

```javascript
// Parameters
// ----------
// domain: String
//     The email domain for which to find the email format. 
// first_name: String or null (Optional)
//     The first name of the person whose email format is being searched.
// middle_name: String or null (Optional)
//     The middle name of the person whose email format is being searched.
// last_name: String or null (Optional)
//     The last name of the person whose email format is being searched.

const payload = {
  domain: "<DOMAIN>",
  first_name: "<FIRST_NAME>",
  middle_name: "<MIDDLE_NAME>",
  last_name: "<LAST_NAME>"
}

try {
  const response = await zeroBounce.guessFormat(payload);
} catch (error) {
  console.error(error);
}
```

**Any of the following email addresses can be used for testing the API, no credits are charged for these test email addresses:**

- disposable@example.com
- invalid@example.com
- valid@example.com
- toxic@example.com
- donotmail@example.com
- spamtrap@example.com
- abuse@example.com
- unknown@example.com
- catch_all@example.com
- antispam_system@example.com
- does_not_accept_mail@example.com
- exception_occurred@example.com
- failed_smtp_connection@example.com
- failed_syntax_check@example.com
- forcible_disconnect@example.com
- global_suppression@example.com
- greylisted@example.com
- leading_period_removed@example.com
- mail_server_did_not_respond@example.com
- mail_server_temporary_error@example.com
- mailbox_quota_exceeded@example.com
- mailbox_not_found@example.com
- no_dns_entries@example.com
- possible_trap@example.com
- possible_typo@example.com
- role_based@example.com
- timeout_exceeded@example.com
- unroutable_ip_address@example.com
- free_email@example.com

**You can use this IP to test the GEO Location in the API.**

- 99.110.204.1

#### Development

After checking out the repo run tests

```bash
npm test
```

You should see an output like this

```bash
Test Suites: 1 passed, 1 total
Tests:       54 passed, 54 total
Snapshots:   0 total
Time:        2.596 s, estimated 3 s
Ran all test suites.
```

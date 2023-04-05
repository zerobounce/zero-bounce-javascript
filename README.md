[ZeroBounce](https://www.zerobounce.net>) JavaScript API v2

This is a JavaScript wrapper class for the ZeroBounce API v2.

## INSTALLATION
```bash
npm install zero-bounce-sdk
```

## USAGE
Import the sdk in your file:

```javascript
import { ZeroBounce } from 'zero-bounce-sdk'
``` 
Initialize the sdk with your api key:

```javascript
ZeroBounce.init("<YOUR_API_KEY>");
```

NOTE: all the methods are asynchronous they have to be used with async / await or .then.catch

## Examples
Then you can use any of the SDK methods, for example:

* ##### Check how many credits you have left on your account
```javascript
import { ZeroBounce } from 'zero-bounce-sdk'
ZeroBounce.init("<YOUR_API_KEY>")
const get_credits = async () => {
    try {
        const response = await ZeroBounce.getCredits();
        console.log(response);
    } catch(error) {
        console.error(error);
    }
}
```
**Properties and possible values returned by: <b><i>getCredits</b></i> method**
  
|<b>Property</b>|<b>Possible Values</b> 
|:--- |:--- 
Credits  | The number of credits left in account for email validation.

  



* ##### Validate an email address
```javascript
import { ZeroBounce } from 'zero-bounce-sdk'
ZeroBounce.init("<YOUR_API_KEY>")

const validate_email = async () => {

    const email = "<EMAIL_ADDRESS>";   // The email address you want to validate
    const ip_address = "127.0.0.1";    // The IP Address the email signed up from (Optional)

    try {
        const response = await ZeroBounce.validateEmail(email, ip_address);
        console.log(response);
    } catch(error) {
        console.error(error);
    }
}
```

**Properties and possible values returned by: <b><i>validateEmail</b></i> method**
  
|<b>Property</b>|<b>Possible Values</b> 
|:--- |:--- 
address  | The email address you are validating. 
status | valid /invalid /catch-all /unknown /spamtrap /abuse /do_not_mail 
sub_status  |antispam_system /greylisted /mail_server_temporary_error /forcible_disconnect /mail_server_did_not_respond /timeout_exceeded /failed_smtp_connection /mailbox_quota_exceeded /exception_occurred /possible_trap /role_based /global_suppression /mailbox_not_found /no_dns_entries /failed_syntax_check /possible_typo /unroutable_ip_address /leading_period_removed /does_not_accept_mail /role_based_catch_all /disposable /toxic
account | The portion of the email address before the "@" symbol.
domain | The portion of the email address after the "@" symbol.
did_you_mean | Suggestive Fix for an email typo.
domain_age_days | Age of the email domain in days or [null].
free_email | [true/false] If the email comes from a free provider.
mx_found | [true/false] Does the domain have an MX record.
mx_record | The preferred MX record of the domain
smtp_provider | The SMTP Provider of the email or [null] (BETA).
firstname | The first name of the owner of the email when available or [null].
lastname  |The last name of the owner of the email when available or [null].
gender |The gender of the owner of the email when available or [null].
country |The country the email signed up when ip address is provided or [null].
region |The region the email signed up when ip address is provided or [null].
city |The city the email signed up when ip address is provided or [null].
zipcode |The zipcode the email signed up when ip address is provided or [null].
processed_at |The UTC time the email was validated.


* ##### Get api usage from a start date to an end date
```javascript
import { ZeroBounce } from 'zero-bounce-sdk'
ZeroBounce.init("<YOUR_API_KEY>")

const get_api_usage = async () => {

    const startDate = "2018-01-01";   // The start date of when you want to view API usage
    const endDate = "2023-12-12";    // The end date of when you want to view API usage

    try {
        const response = await ZeroBounce.getApiUsage(startDate, endDate);
        console.log(response);
    } catch(error) {
        console.error(error);
    }
}
```






**Any of the following email addresses can be used for testing the API, no credits are charged for these test email addresses:**
+ disposable@example.com
+ invalid@example.com
+ valid@example.com
+ toxic@example.com
+ donotmail@example.com
+ spamtrap@example.com
+ abuse@example.com
+ unknown@example.com
+ catch_all@example.com
+ antispam_system@example.com
+ does_not_accept_mail@example.com
+ exception_occurred@example.com
+ failed_smtp_connection@example.com
+ failed_syntax_check@example.com
+ forcible_disconnect@example.com
+ global_suppression@example.com
+ greylisted@example.com
+ leading_period_removed@example.com
+ mail_server_did_not_respond@example.com
+ mail_server_temporary_error@example.com
+ mailbox_quota_exceeded@example.com
+ mailbox_not_found@example.com
+ no_dns_entries@example.com
+ possible_trap@example.com
+ possible_typo@example.com
+ role_based@example.com
+ timeout_exceeded@example.com
+ unroutable_ip_address@example.com
+ free_email@example.com

**You can use this IP to test the GEO Location in the API.**

+ 99.110.204.1


{\rtf1\ansi\ansicpg1252\cocoartf2709
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 ## ZeroBounce API de JavaScript v2\
\
Esta es una clase envoltorio en JavaScript para la API v2 de ZeroBounce.\
\
## INSTALACI\'d3N\
\
```bash\
npm install @zerobounce/zero-bounce-sdk\
```\
\
## USO\
\
Agregue el script\
\
```HTML\
<script src="<RUTA_AL_SCRIPT/zeroBounceSDK.js"></script>\
```\
\
```HTML\
<script>\
const zeroBounce = new ZeroBounceSDK();\
</script>\
```\
\
O\
\
Agregue el m\'f3dulo npm\
\
```javascript\
const ZeroBounceSDK = require('@zerobounce/zero-bounce-sdk')\
\
const zeroBounce = new ZeroBounceSDK();\
```\
\
Inicialice el SDK con su clave de API:\
\
```javascript\
zeroBounce.init("<SU_CLAVE_DE_API>");\
```\
\
NOTA: todos los m\'e9todos son as\'edncronos y deben usarse con async / await o .then.catch.\
\
## Ejemplos\
\
Luego puede utilizar cualquiera de los m\'e9todos del SDK, por ejemplo:\
\
- ##### Verificar cu\'e1ntos cr\'e9ditos le quedan en su cuenta\
\
```javascript\
try \{\
  const response = await zeroBounce.getCredits();\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Validar una direcci\'f3n de correo electr\'f3nico\
\
```javascript\
const email = "<DIRECCI\'d3N_DE_CORREO_ELECTR\'d3NICO>"; // La direcci\'f3n de correo electr\'f3nico que desea validar\
const ip_address = "127.0.0.1"; // La direcci\'f3n IP desde la cual se registr\'f3 el correo electr\'f3nico (opcional)\
\
try \{\
  const response = await zeroBounce.validateEmail(email, ip_address);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Obtener el uso de la API desde una fecha de inicio hasta una fecha de finalizaci\'f3n\
\
```javascript\
const startDate = "2018-01-01"; // La fecha de inicio de cuando desea ver el uso de la API\
const endDate = "2023-12-12"; // La fecha de finalizaci\'f3n de cuando desea ver el uso de la API\
\
try \{\
  const response = await zeroBounce.getApiUsage(startDate, endDate);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Validar una lista de direcciones de correo electr\'f3nico\
\
```javascript\
const emailBatch = [\
  \{ email_address: "<DIRECCI\'d3N_DE_CORREO_ELECTR\'d3NICO>" \},\
  \{ email_address: "<DIRECCI\'d3N_DE_CORREO_ELECTR\'d3NICO>" \},\
]; // un array que contiene una lista de objetos de correo electr\'f3nico \{email_address: "ejemplo@ejemplo.com"\}\
\
try \{\
  const response = await zeroBounce.validateBatch(emailBatch);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Obtener datos sobre la actividad de un correo electr\'f3nico\
\
```javascript\
const email = "<DIRECCI\'d3N_DE_CORREO_ELECTR\'d3NICO>"; // La direcci\'f3n de correo electr\'f3nico de la que desea obtener la actividad\
\
try \{\
  const response = await zeroBounce.getEmailActivity(email);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Enviar un archivo CSV que contenga direcciones de correo electr\'f3nico para validar\
\
```javascript\
// Par\'e1metros\
// ----------\
// file: File\
//     El archivo CSV o TXT que se enviar\'e1.\
// email_address_column: number\
//     El \'edndice de columna de la direcci\'f3n de correo electr\'f3nico en el archivo. El \'edndice comienza en 1.\
// return_url: str o null (Opcional)\
//     La URL se utilizar\'e1 para llamar de vuelta cuando\
\
 se complete la validaci\'f3n.\
// first_name_column: number o null (Opcional)\
//     El \'edndice de columna del nombre en el archivo.\
// last_name_column: number o null (Opcional)\
//     El \'edndice de columna del apellido en el archivo.\
// gender_column: number o null (Opcional)\
//     El \'edndice de columna del g\'e9nero en el archivo.\
// ip_address_column: number o null (Opcional)\
//     La direcci\'f3n IP desde la cual se registr\'f3 el correo electr\'f3nico.\
// has_header_row: Boolean (Opcional)\
//     Si la primera fila del archivo enviado es una fila de encabezado.\
// remove_duplicate: Boolean (Opcional)\
//     Si desea que el sistema elimine los correos electr\'f3nicos duplicados.\
const payload = \{\
  file: "<ARCHIVO>",\
  email_address_column: "<N\'daMERO_DE_COLUMNA>", // por ejemplo, 3\
  return_url: "<URL_DE_RETORNO>", // (Opcional)\
  first_name_column: "<N\'daMERO_DE_COLUMNA>", // por ejemplo, 3 (Opcional)\
  last_name_column: "<N\'daMERO_DE_COLUMNA>", // por ejemplo, 3 (Opcional)\
  gender_column: "<N\'daMERO_DE_COLUMNA>", // por ejemplo, 3 (Opcional)\
  ip_address_column: "<N\'daMERO_DE_COLUMNA>", // por ejemplo, 3 (Opcional)\
  has_header_row: true / false, // (Opcional)\
  remove_duplicate: true / false, // (Opcional)\
\};\
\
try \{\
  const response = await zeroBounce.sendFile(payload);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Enviar un archivo CSV que contenga direcciones de correo electr\'f3nico para obtener la puntuaci\'f3n de los correos electr\'f3nicos\
\
```javascript\
// Par\'e1metros\
// ----------\
// file: File\
//     El archivo CSV o TXT que se enviar\'e1.\
// email_address_column: number\
//     El \'edndice de columna de la direcci\'f3n de correo electr\'f3nico en el archivo. El \'edndice comienza en 1.\
// return_url: str o null (Opcional)\
//     La URL se utilizar\'e1 para llamar de vuelta cuando se complete la validaci\'f3n.\
// has_header_row: Boolean (Opcional)\
//     Si la primera fila del archivo enviado es una fila de encabezado.\
// remove_duplicate: Boolean (Opcional)\
//     Si desea que el sistema elimine los correos electr\'f3nicos duplicados.\
const payload = \{\
  file: "<ARCHIVO>",\
  email_address_column: "<N\'daMERO_DE_COLUMNA>", // por ejemplo, 3\
  return_url: "<URL_DE_RETORNO>", // (Opcional)\
  has_header_row: true / false,\
  remove_duplicate: true / false, // (Opcional)\
\};\
\
try \{\
  const response = await zeroBounce.sendScoringFile(payload);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### El estado de finalizaci\'f3n de un archivo enviado anteriormente\
\
```javascript\
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente\
\
try \{\
  const response = await zeroBounce.getFileStatus(fileId);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### El estado de finalizaci\'f3n de un archivo de puntuaci\'f3n enviado anteriormente\
\
```javascript\
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente\
\
\
\
try \{\
  const response = await zeroBounce.getScoringFileStatus(fileId);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Obtener el archivo con los datos validados\
\
```javascript\
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente\
\
try \{\
  const response = await zeroBounce.getFile(fileId);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Obtener el archivo con los datos de puntuaci\'f3n\
\
```javascript\
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente\
\
try \{\
  const response = await zeroBounce.getScoringFile(fileId);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Eliminar el archivo con los datos validados\
\
```javascript\
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente\
\
try \{\
  const response = await zeroBounce.deleteFile(fileId);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
- ##### Eliminar el archivo con los datos de puntuaci\'f3n\
\
```javascript\
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente\
\
try \{\
  const response = await zeroBounce.deleteScoringFile(fileId);\
\} catch (error) \{\
  console.error(error);\
\}\
```\
\
**Puede utilizar cualquiera de las siguientes direcciones de correo electr\'f3nico para probar la API, no se cobran cr\'e9ditos por estas direcciones de correo electr\'f3nico de prueba:**\
\
- disposable@example.com\
- invalid@example.com\
- valid@example.com\
- toxic@example.com\
- donotmail@example.com\
- spamtrap@example.com\
- abuse@example.com\
- unknown@example.com\
- catch_all@example.com\
- antispam_system@example.com\
- does_not_accept_mail@example.com\
- exception_occurred@example.com\
- failed_smtp_connection@example.com\
- failed_syntax_check@example.com\
- forcible_disconnect@example.com\
- global_suppression@example.com\
- greylisted@example.com\
- leading_period_removed@example.com\
- mail_server_did_not_respond@example.com\
- mail_server_temporary_error@example.com\
- mailbox_quota_exceeded@example.com\
- mailbox_not_found@example.com\
- no_dns_entries@example.com\
- possible_trap@example.com\
- possible_typo@example.com\
- role_based@example.com\
- timeout_exceeded@example.com\
- unroutable_ip_address@example.com\
- free_email@example.com\
\
**Puede utilizar esta direcci\'f3n IP para probar la ubicaci\'f3n geogr\'e1fica en la API.**\
\
- 99.110.204.1\
\
## Desarrollo\
\
Despu\'e9s de verificar el repositorio, ejecute las pruebas\
\
```bash\
npm test\
```\
\
Deber\'eda ver una salida como esta\
\
```bash\
Test Suites: 1 passed, 1 total\
Tests:       54 passed, 54 total\
Snapshots:   0 total\
Time:        2.596 s, estimated 3 s\
Ran all test suites.\
```}

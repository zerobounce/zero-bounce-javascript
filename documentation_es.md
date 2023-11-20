
NO RECOMENDAMOS USAR ESTE KIT DE DESARROLLO EN UN ENTORNO DE FRONT-END, YA QUE LA CLAVE DE API SERÁ VISIBLE.

#### INSTALACIÓN

```bash
npm install @zerobounce/zero-bounce-sdk
```

#### USO

Agregue el script

```HTML
<script src="<RUTA_AL_SCRIPT/zeroBounceSDK.js"></script>
```

```HTML
<script>
const zeroBounce = new ZeroBounceSDK();
</script>
```

O

Agregue el módulo npm

```javascript
const ZeroBounceSDK = require('zero-bounce-sdk')

const zeroBounce = new ZeroBounceSDK();
```

Inicialice el SDK con su clave de API:

```javascript
zeroBounce.init("<SU_CLAVE_DE_API>");
```

NOTA: todos los métodos son asíncronos y deben usarse con async / await o .then.catch.

#### Ejemplos

Luego puede utilizar cualquiera de los métodos del SDK, por ejemplo:

- ####### Verificar cuántos créditos le quedan en su cuenta

```javascript
try {
  const response = await zeroBounce.getCredits();
} catch (error) {
  console.error(error);
}
```

- ####### Validar una dirección de correo electrónico

```javascript
const email = "<DIRECCIÓN_DE_CORREO_ELECTRÓNICO>"; // La dirección de correo electrónico que desea validar
const ip_address = "127.0.0.1"; // La dirección IP desde la cual se registró el correo electrónico (opcional)

try {
  const response = await zeroBounce.validateEmail(email, ip_address);
} catch (error) {
  console.error(error);
}
```

- ####### Obtener el uso de la API desde una fecha de inicio hasta una fecha de finalización

```javascript
const startDate = "2018-01-01"; // La fecha de inicio de cuando desea ver el uso de la API
const endDate = "2023-12-12"; // La fecha de finalización de cuando desea ver el uso de la API

try {
  const response = await zeroBounce.getApiUsage(startDate, endDate);
} catch (error) {
  console.error(error);
}
```

- ####### Validar una lista de direcciones de correo electrónico

```javascript
const emailBatch = [
  { email_address: "<DIRECCIÓN_DE_CORREO_ELECTRÓNICO>" },
  { email_address: "<DIRECCIÓN_DE_CORREO_ELECTRÓNICO>" },
]; // un array que contiene una lista de objetos de correo electrónico {email_address: "ejemplo@ejemplo.com"}

try {
  const response = await zeroBounce.validateBatch(emailBatch);
} catch (error) {
  console.error(error);
}
```

- ####### Obtener datos sobre la actividad de un correo electrónico

```javascript
const email = "<DIRECCIÓN_DE_CORREO_ELECTRÓNICO>"; // La dirección de correo electrónico de la que desea obtener la actividad

try {
  const response = await zeroBounce.getEmailActivity(email);
} catch (error) {
  console.error(error);
}
```

- ####### Enviar un archivo CSV que contenga direcciones de correo electrónico para validar

```javascript
// Parámetros
// ----------
// file: File
//     El archivo CSV o TXT que se enviará.
// email_address_column: number
//     El índice de columna de la dirección de correo electrónico en el archivo. El índice comienza en 1.
// return_url: str o null (Opcional)
//     La URL se utilizará para llamar de vuelta cuando

 se complete la validación.
// first_name_column: number o null (Opcional)
//     El índice de columna del nombre en el archivo.
// last_name_column: number o null (Opcional)
//     El índice de columna del apellido en el archivo.
// gender_column: number o null (Opcional)
//     El índice de columna del género en el archivo.
// ip_address_column: number o null (Opcional)
//     La dirección IP desde la cual se registró el correo electrónico.
// has_header_row: Boolean (Opcional)
//     Si la primera fila del archivo enviado es una fila de encabezado.
// remove_duplicate: Boolean (Opcional)
//     Si desea que el sistema elimine los correos electrónicos duplicados.
const payload = {
  file: "<ARCHIVO>",
  email_address_column: "<NÚMERO_DE_COLUMNA>", // por ejemplo, 3
  return_url: "<URL_DE_RETORNO>", // (Opcional)
  first_name_column: "<NÚMERO_DE_COLUMNA>", // por ejemplo, 3 (Opcional)
  last_name_column: "<NÚMERO_DE_COLUMNA>", // por ejemplo, 3 (Opcional)
  gender_column: "<NÚMERO_DE_COLUMNA>", // por ejemplo, 3 (Opcional)
  ip_address_column: "<NÚMERO_DE_COLUMNA>", // por ejemplo, 3 (Opcional)
  has_header_row: true / false, // (Opcional)
  remove_duplicate: true / false, // (Opcional)
};

try {
  const response = await zeroBounce.sendFile(payload);
} catch (error) {
  console.error(error);
}
```

- ####### Enviar un archivo CSV que contenga direcciones de correo electrónico para obtener la puntuación de los correos electrónicos

```javascript
// Parámetros
// ----------
// file: File
//     El archivo CSV o TXT que se enviará.
// email_address_column: number
//     El índice de columna de la dirección de correo electrónico en el archivo. El índice comienza en 1.
// return_url: str o null (Opcional)
//     La URL se utilizará para llamar de vuelta cuando se complete la validación.
// has_header_row: Boolean (Opcional)
//     Si la primera fila del archivo enviado es una fila de encabezado.
// remove_duplicate: Boolean (Opcional)
//     Si desea que el sistema elimine los correos electrónicos duplicados.
const payload = {
  file: "<ARCHIVO>",
  email_address_column: "<NÚMERO_DE_COLUMNA>", // por ejemplo, 3
  return_url: "<URL_DE_RETORNO>", // (Opcional)
  has_header_row: true / false,
  remove_duplicate: true / false, // (Opcional)
};

try {
  const response = await zeroBounce.sendScoringFile(payload);
} catch (error) {
  console.error(error);
}
```

- ####### El estado de finalización de un archivo enviado anteriormente

```javascript
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente

try {
  const response = await zeroBounce.getFileStatus(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### El estado de finalización de un archivo de puntuación enviado anteriormente

```javascript
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente



try {
  const response = await zeroBounce.getScoringFileStatus(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Obtener el archivo con los datos validados

```javascript
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente

try {
  const response = await zeroBounce.getFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Obtener el archivo con los datos de puntuación

```javascript
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente

try {
  const response = await zeroBounce.getScoringFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Eliminar el archivo con los datos validados

```javascript
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente

try {
  const response = await zeroBounce.deleteFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Eliminar el archivo con los datos de puntuación

```javascript
const fileId = "<ID_DE_ARCHIVO>"; // El ID de un archivo enviado anteriormente

try {
  const response = await zeroBounce.deleteScoringFile(fileId);
} catch (error) {
  console.error(error);
}
```

**Puede utilizar cualquiera de las siguientes direcciones de correo electrónico para probar la API, no se cobran créditos por estas direcciones de correo electrónico de prueba:**

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

**Puede utilizar esta dirección IP para probar la ubicación geográfica en la API.**

- 99.110.204.1

#### Desarrollo

Después de verificar el repositorio, ejecute las pruebas

```bash
npm test
```

Debería ver una salida como esta

```bash
Test Suites: 1 passed, 1 total
Tests:       54 passed, 54 total
Snapshots:   0 total
Time:        2.596 s, estimated 3 s
Ran all test suites.
```

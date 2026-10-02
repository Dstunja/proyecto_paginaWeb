# Empalme con Control360 — análisis previo

Las postulaciones del formulario de `/empleos/` deben llegar a **Control360**, el
aplicativo interno de la empresa. Este documento es el **análisis previo**: qué
hace falta preguntarle a quien administra C360, cómo quedaría el flujo durante la
transición, qué hacer cuando C360 responda lento o no responda, y qué cambia en el
registro para poder demostrar que C360 recibió de verdad.

**No propone todavía ninguna línea de código.** Hay decisiones que dependen de
respuestas que no tenemos.

**Fecha: 2 de octubre de 2026.** El estado actual del sistema está levantado en
`docs/INVENTARIO-TECNICO.md`; aquí se da por leído.

## El requisito que manda sobre todo lo demás

> En septiembre se perdieron dos semanas de postulaciones por un fallo silencioso.

Eso fija el criterio de diseño y **no es negociable**: un fallo de C360 **no puede
tumbar una postulación**, y —tan importante— **no puede pasar desapercibido**. Son
dos exigencias distintas y hacen falta las dos. Un sistema que no pierde datos pero
no avisa de que algo va mal termina perdiéndolos igual, solo más tarde y con más
trabajo encima.

De ahí salen dos reglas que recorren todo el documento:

1. **Escribir primero, enviar después.** Una postulación se guarda en un sitio
   durable **antes** de intentar entregarla a ningún sitio. Lo que se puede perder
   es un envío, nunca el dato.
2. **El silencio no puede parecerse al éxito.** Si C360 deja de recibir, alguien
   tiene que enterarse **ese día**, por un aviso activo. Hoy los registros de
   Vercel duran una hora: no se puede vigilar nada mirando registros.

Hay además una tercera regla, que es la que ya rige el formulario hoy y conviene
mantener: **el candidato no paga los problemas de la integración**. Lo que ve en
pantalla no debe empeorar porque C360 esté caído.

---

## 1. Qué hay que pedirle a quien administra Control360

Esta sección está escrita para **reenviarla tal cual**. Son 27 preguntas en seis
bloques. Las tres primeras pueden **cambiar el proyecto entero**, así que conviene
no dejarlas para el final de la conversación.

### Bloque 0 — Lo que puede hacer imposible la integración (preguntar primero)

**1. ¿C360 es alcanzable desde internet, o solo desde la red interna de la
empresa?**
Esta es *la* pregunta. Nuestro backend son **funciones serverless de Vercel**, que
corren en la nube de Vercel y **no están dentro de la red de la empresa**. Si C360
solo responde en la red interna o detrás de VPN, **no hay integración directa
posible** y habría que cambiar de enfoque: que C360 venga a buscar las
postulaciones (nos pregunta a nosotros, en vez de nosotros a él), o poner un
intermediario alcanzable por los dos. Sería un diseño distinto, no un ajuste.

**2. ¿C360 filtra por dirección IP de origen?**
Es muy habitual en aplicativos internos y aquí es un problema: **Vercel en el plan
Hobby no da direcciones IP de salida fijas.** Las funciones salen por direcciones
que cambian. Si C360 exige una lista blanca de IPs, hace falta una de estas tres:
que C360 autentique por credencial en vez de por IP, subir de plan en Vercel a uno
con IP de salida dedicada, o pasar por un intermediario con IP fija.

**3. ¿Qué nombre de dominio y qué certificado tiene?**
Si el certificado es autofirmado o emitido por una CA interna, la llamada fallará
en la validación TLS. Necesitamos un certificado que una CA pública reconozca, o
saber de antemano que hay que tratar ese caso.

### Bloque 1 — El endpoint

**4. URL exacta del endpoint** que recibe una postulación, y **método** (se asume
`POST`).

**5. ¿Hay URL de pruebas además de la de producción?** Ver el bloque 5.

**6. ¿Qué espera recibir exactamente?** Lo ideal es un ejemplo real de petición
que haya funcionado: cabeceras y cuerpo completos. Un ejemplo vale más que una
especificación.

**7. ¿Qué devuelve cuando acepta?** Código HTTP, y sobre todo: **¿devuelve un
identificador propio del registro que creó?** De esto depende por completo poder
verificar la recepción (sección 4). Si no devuelve nada más que un 200, hace falta
otra forma de confirmar.

**8. ¿Qué devuelve cuando rechaza?** Formato del error, y **qué códigos HTTP usa
para qué**. En particular: ¿distingue «los datos están mal» (reintentar no sirve)
de «estoy ocupado o caído» (reintentar sí sirve)? Si todo sale como 500, no se
puede decidir si reintentar.

**9. ¿Hay límite de peticiones por minuto?** Y si se pasa, ¿qué responde?

### Bloque 2 — Autenticación

**10. ¿Cómo se autentica la llamada?** Nos sirve cualquiera de las habituales, y
el orden de preferencia es este, por motivos prácticos:

| Preferencia | Método | Por qué |
| --- | --- | --- |
| 1ª | **Token fijo en cabecera** (`Authorization: Bearer …` o una cabecera propia) | Es lo más simple de operar: una variable de entorno en Vercel y nada más |
| 2ª | **OAuth2 client credentials** | Funciona bien, pero añade una llamada previa por token y un token que caduca y hay que renovar y cachear |
| 3ª | **mTLS (certificado de cliente)** | Hay que verificar que el entorno de Vercel lo permite tal como está montado hoy. Puede no ser viable sin cambios |
| — | **Usuario y contraseña de un usuario humano** | **Preferimos evitarlo.** Si alguien le cambia la contraseña o se le bloquea la cuenta, la integración se cae sin aviso |

**11. ¿El credencial caduca?** Cada cuánto, y **quién avisa antes de que caduque**.
Un token que caduca sin aviso es exactamente la forma de un fallo silencioso: todo
funciona hasta un martes a las tres de la tarde.

**12. ¿Hay un credencial distinto para pruebas y para producción?** Debería
haberlo.

### Bloque 3 — El formato del envío y el PDF

**13. ¿En qué formato quiere los datos?** JSON es lo natural para nosotros.

**14. ¿Qué campos espera, con qué nombres, cuáles obligatorios y con qué
validaciones?** Lo que tenemos hoy del candidato es esto, y no hay más:

| Dato | Obligatorio | Forma |
| --- | --- | --- |
| Nombre completo | Sí | Texto libre |
| Correo electrónico | Sí | Validado |
| Teléfono | Sí | Celular colombiano de 10 dígitos, con o sin `57` |
| Cargo al que se postula | Sí | **De una lista cerrada** definida en el sitio |
| Experiencia | **No** | Texto libre, puede venir vacío |
| Autorización de tratamiento de datos (Ley 1581) | Sí | Siempre `true`: sin marcarla el formulario no envía |
| Hoja de vida | Sí | **PDF, DOC o DOCX**, máximo 4 MB |
| Fecha y hora de recepción | — | La ponemos nosotros, zona `America/Bogota` |
| Si pasó la verificación antirrobots | — | La ponemos nosotros, ver pregunta 20 |

**15. Los cargos: ¿C360 tiene su propio catálogo con códigos?** Si los tiene,
necesitamos **la lista de códigos** para mandar el código y no el texto. Si no,
mandamos el texto tal como está en el sitio. Ojo: el nombre del cargo que se
publica en la web es el que manda para el candidato y no se va a reescribir para
que coincida con otro catálogo; si los nombres difieren, la correspondencia se hace
en el envío.

**16. ¿Pide algún dato que hoy NO pedimos?** (documento de identidad, ciudad,
fecha de nacimiento, salario esperado…). Importa saberlo ya: si C360 exige un campo
obligatorio que no tenemos, **hay que añadirlo al formulario**, y eso es trabajo de
diseño y de texto legal, no de integración. Y cada campo nuevo es un campo más que
el candidato puede abandonar.

**17. ¿Cómo quiere recibir la hoja de vida?** Es la decisión técnica más
importante después del bloque 0. Las tres formas, con lo que cuesta cada una:

| Forma | Cómo sería | A favor | En contra |
| --- | --- | --- | --- |
| **URL firmada** (nuestra preferencia) | Mandamos el JSON con un enlace temporal; C360 descarga el archivo cuando quiera | El envío es de 2 KB, rápido y sin riesgo de tiempo de espera. Ya tenemos la máquina de enlaces firmados funcionando | C360 tiene que poder salir a internet a descargar. Hay que acordar **cuánto dura el enlace**: nuestros enlaces actuales duran 7 días |
| **multipart/form-data** | Un solo envío con los campos y el archivo | Un solo paso, y C360 ya tiene el archivo cuando responde | El envío pesa hasta 4 MB. Más tiempo dentro de la función, más probabilidad de agotar el plazo |
| **base64 dentro del JSON** | El archivo codificado como texto en un campo | Simple de implementar en los dos lados | **Crece un 33 %**: 4 MB se vuelven 5,4 MB. Hay que confirmar que C360 acepta cuerpos de ese tamaño |

**18. Si es URL firmada: ¿cuánto tiempo necesita que viva el enlace, y qué pasa si
C360 lo descarga más tarde?** Y al revés: ¿nos avisa cuando ya descargó, para que
podamos dejar de conservar el archivo?

**19. ¿Hay tope de tamaño de cuerpo en el endpoint?** Nosotros estamos limitados a
4 MB de hoja de vida por el tope de 4,5 MB de cuerpo de una función de Vercel.

**20. ¿Quiere saber si la postulación no pasó la verificación antirrobots?**
Nuestro formulario acepta a propósito postulaciones que no pudieron resolver el
reto de Cloudflare —pasa de verdad con WebViews de WhatsApp, bloqueadores y
teléfonos viejos— y las marca `[SIN VERIFICAR]` en el asunto del correo, para que
Talento Humano las lea con algo más de criterio. **No significa que sean falsas.**
Podemos mandar ese indicador en el payload si C360 quiere mostrarlo igual.

### Bloque 4 — Duplicados y confirmación

**21. ¿Qué pasa si la misma postulación llega dos veces?** Es importante y se
subestima: **vamos a reintentar** cuando C360 no responda, y un reintento sobre una
petición que en realidad sí se procesó crea un duplicado. Dos formas de evitarlo, y
necesitamos una:

- **La buena:** C360 acepta una **clave de idempotencia** (nosotros mandamos
  nuestro identificador `EMP-20261002-A7K2M9`) y, si ya la vio, responde con el
  mismo resultado sin crear otro registro.
- **La aceptable:** C360 deduplica por su cuenta (por correo + cargo, por ejemplo)
  y nos dice con qué criterio.

**22. ¿Hay forma de consultar una postulación ya enviada?** Un `GET` por el
identificador que nos devolvió, o por nuestro `EMP-…`. **Esto es lo que convierte
«C360 contestó 200» en «C360 tiene el dato».** Son cosas distintas y la diferencia
es justo donde se esconden los fallos silenciosos. Si no hay consulta, la
alternativa es que **C360 nos llame de vuelta** (webhook) cuando haya procesado.

**23. ¿Cuánto tarda normalmente en responder, y cuál es el peor caso?** Si una
respuesta normal tarda ocho segundos, el diseño cambia: no cabe dentro de la
petición del candidato y hay que mandarlo en segundo plano desde el principio.

### Bloque 5 — Pruebas y operación

**24. ¿Hay entorno de pruebas?** Y si lo hay: URL, credencial propia, y **¿los
datos de prueba van a una base separada?** Necesitamos poder mandar veinte
postulaciones falsas sin ensuciar el aplicativo que usa Talento Humano.
**Si no hay entorno de pruebas**, hay que acordar un modo de trabajo: una vacante
de prueba que luego se borre, una ventana horaria, o un cargo reservado. No se
puede integrar a ciegas contra producción y es razonable no querer probar por
primera vez con la postulación de una persona real.

**25. ¿A quién se avisa cuando la integración falla?** Un nombre y un canal, no un
buzón genérico. En septiembre el problema no fue que algo se rompiera: fue que
nadie se enteró.

**26. ¿Hay ventanas de mantenimiento programadas?** Si C360 se apaga los domingos a
las dos de la mañana, conviene saberlo antes de interpretar la alerta.

**27. ¿Qué hace C360 con el PDF, y cuánto lo conserva?** Hace falta para cerrar
nuestra propia política de retención (Ley 1581): si C360 es el archivo definitivo,
nosotros podemos borrar antes.

---

## 2. El flujo durante la transición: C360 **y** correo, en paralelo

### Cómo es hoy

```
Candidato → valida → antirrobots → CORREO a Talento Humano (3 intentos)
                                        │
                                        └─ si falla → guarda en Blob → correo con enlace
```

El Blob es hoy **la red de seguridad**: solo se escribe cuando el correo ya falló.

### Cómo debería quedar

El cambio de fondo es **un solo movimiento**, y es el que hace posible todo lo
demás: **el Blob pasa de ser la red de seguridad a ser el primer paso.** Se escribe
siempre, antes de intentar entregar nada a nadie.

```
Candidato
   │
   ├─ 1. Validar, antirrobots, límite por IP          (sin cambios)
   │
   ├─ 2. GUARDAR EN EL BLOB  ← SIEMPRE, no solo cuando algo falla
   │      hoja de vida + registro.json (estado: pendiente en los dos canales)
   │      Si esto falla → 500. Es el único fallo que impide postular.
   │
   ├─ 3. CORREO a Talento Humano         (el canal de hoy, sin cambios)
   │      3 intentos → anota el resultado en el registro
   │
   ├─ 4. ENVÍO A C360                    (el canal nuevo)
   │      1 intento + 1 reintento, con plazo corto → anota el resultado
   │      PASE LO QUE PASE AQUÍ, NO CAMBIA LO QUE VE EL CANDIDATO
   │
   └─ 5. Responder «Postulación enviada»
          Depende SOLO del paso 2. Los pasos 3 y 4 no pueden hacer fallar esto.

          ⟳ Aparte, un proceso programado (cron):
             reintenta lo que quedó pendiente, y manda UN RESUMEN DIARIO
```

### Por qué en ese orden, y no en otro

**El Blob primero.** Es el único paso cuyo fallo puede costar una postulación, así
que es el único que debe ir antes que nada. Una vez escrito, cualquier entrega se
puede reintentar después, hoy o mañana. Es también lo que permite que el paso 4 no
dé miedo: si C360 falla, no se perdió nada, solo queda trabajo pendiente.

El precio es real y conviene decirlo: **hoy el Blob se escribe en el caso raro, y
pasaría a escribirse siempre.** Eso significa hasta 4 MB por postulación de forma
permanente, con dos consecuencias:

- **Hay que medir el consumo del store** y comprobar que cabe en el plan.
- **Hay que encender la retención de hojas de vida** (`docs/INVENTARIO-TECNICO.md`,
  7.8), que hoy está programada pero apagada con dos cerrojos. Un almacén de datos
  personales que crece siempre y no se vacía nunca deja de ser un detalle: es un
  incumplimiento de la Ley 1581.

**El correo antes que C360.** Es el canal que funciona hoy y el que Talento Humano
usa de verdad. Si el nuevo está lento, no debe retrasar el que ya sirve.

**C360 al final, y sin poder hacer fallar nada.** Durante toda la transición C360 es
el canal **adicional**. Su resultado se anota, nunca decide la respuesta.

### Qué ve el candidato

**Lo mismo que hoy, en todos los casos.** No se le muestra nada de C360: no es su
problema, no puede hacer nada al respecto, y un mensaje de error que no da ninguna
acción posible solo consigue que no se postule. El contrato de la pantalla no
cambia.

### Lo que NO hay que hacer

Tres atajos que parecen razonables y rompen el requisito:

- **Llamar a C360 desde el navegador del candidato.** Expondría el credencial, lo
  bloquearía la Content-Security-Policy, y dejaría el resultado a merced de la red
  del candidato.
- **Poner C360 antes de guardar en el Blob o antes del correo.** Un C360 lento
  retrasaría el correo hasta agotar el plazo de la función, y un C360 caído
  tumbaría el canal que hoy funciona. Es, literalmente, el fallo de septiembre otra
  vez.
- **Hacer que la respuesta al candidato dependa de C360.** Si C360 está caído, el
  candidato vería un error y se iría, con la postulación ya guardada. Habría
  perdido a un candidato por un problema que no era suyo.

### Cuándo se apaga el correo

No en la primera semana, y **no por decisión técnica**. Un criterio razonable para
proponer el cambio:

1. **Dos semanas** en las que el **100 %** de las postulaciones aparezcan
   confirmadas en C360 (confirmadas de verdad, en el sentido de la sección 4).
2. Talento Humano trabajando ya **dentro de C360**, no en el correo.
3. El aviso diario funcionando y leído por alguien.

Y aun entonces, el aviso diario y el guardado en el Blob **se quedan**: son lo que
hace visible el día que C360 deje de recibir.

---

## 3. Si C360 responde lento o no responde

### El plazo disponible, y por qué hay que medirlo antes

Dentro de una petición no hay tiempo infinito: una función de Vercel tiene una
duración máxima, y la petición de una postulación ya gasta buena parte de ella en
leer hasta 4 MB de multipart, hasta tres intentos de Resend con dos segundos de
pausas acumuladas, y la escritura en el Blob.

**(Deducción, y hay que confirmarla antes de fijar números.)** El plazo exacto
configurado en el proyecto se consulta en el panel de Vercel; en el repositorio no
está declarado. Con lo que ya se gasta, lo prudente es que el envío a C360 **no
pueda consumir más de unos 5 segundos en total**. El número definitivo sale de dos
datos: el plazo real de la función y la respuesta a la pregunta 23.

**Si C360 tarda normalmente más que eso, el diseño cambia:** el envío no va dentro
de la petición del candidato, va solo por el proceso programado. Es perfectamente
aceptable —la postulación ya está guardada— y solo significa que C360 la recibe con
unos minutos de retraso en vez de al instante.

### Plazos y reintentos propuestos

| Cuándo | Qué |
| --- | --- |
| **Plazo de una llamada** | ~3 s. Pasado eso se corta y se trata como fallo. Importa cortar nosotros: una conexión que se queda colgada se come el plazo de la función y arrastra a la postulación entera |
| **Reintentos dentro de la petición** | **Uno solo**, y solo para fallos que pueden cambiar de respuesta: tiempo agotado, error de red, `429`, `5xx`. Pausa corta |
| **Lo que NO se reintenta nunca ahí** | `400`, `401`, `403`, `422`. Un rechazo por datos o por credencial da el mismo resultado las diez veces: solo gasta plazo. Se anota y se deja para el proceso programado, que es donde alguien puede mirarlo |
| **Reintentos del proceso programado** | Espera creciente (p. ej. 15 min, 1 h, 6 h, 24 h) y un tope de intentos. Pasado el tope, la postulación queda marcada como **requiere atención manual** y entra en el aviso diario |
| **Siempre** | La clave de idempotencia (nuestro `EMP-…`) viaja en cada intento, para que un reintento sobre algo que sí se procesó no cree un duplicado (pregunta 21) |

### ¿La hoja de vida sigue en el Blob?

**Sí, y con más razón que hoy.** Cuatro motivos, y cada uno sería suficiente:

1. **Es lo que hace posible el reintento.** El proceso programado que vuelve a
   intentar mañana necesita el archivo. Si vive solo en la memoria de la función,
   se fue con la petición.
2. **Si C360 descarga por URL firmada, el Blob es de dónde descarga.** Sin archivo
   guardado, esa opción no existe.
3. **Es la prueba.** Mientras no haya confirmación de recepción, el Blob es el
   único sitio donde la postulación existe con certeza.
4. **Es lo que ya funciona**, probado, con enlaces firmados y control de acceso.

Con un matiz que hay que decidir con la pregunta 27: **cuándo se deja de
conservar**. Si C360 pasa a ser el archivo definitivo, se puede borrar pronto
después de confirmada la recepción, y eso es mejor para todos —menos datos
personales guardados, menos consumo—. Mientras C360 no esté confirmado como
definitivo, se conserva el plazo completo. La decisión es del negocio, no técnica.

---

## 4. Qué cambia en el registro para verificar que C360 recibió **de verdad**

Esta sección es la que responde al fallo de septiembre.

### El problema de fondo: «aceptó» no es «recibió»

Un `200 OK` significa que el servidor **aceptó la petición**. No significa que el
dato esté guardado, ni visible, ni procesado. Entre las dos cosas caben: una
transacción que se deshizo después de responder, una cola que se atascó, un
proceso posterior que falló, un registro creado en un estado que nadie mira.

Es el mismo problema que ya tenemos con el correo y que ya está documentado:
`enviada` en nuestro registro significa que **Resend aceptó**, no que el correo
llegara; puede acabar en rebote o en lista de supresión sin que la función lo sepa.
Con C360 conviene no repetir el error de llamar «recibido» a lo que solo es
«aceptado».

### Tres niveles de evidencia, y cuál hay que exigir

| Nivel | Qué es | Qué vale |
| --- | --- | --- |
| **1. Aceptado** | C360 devolvió 2xx | Poco. Es lo mínimo y es lo que falla en silencio |
| **2. Identificado** | C360 devolvió **su** identificador del registro creado | Bastante más: hay algo que señalar y por lo que preguntar |
| **3. Confirmado** | **Volvimos a preguntar y C360 dijo que lo tiene** (consulta por el identificador), **o** C360 nos llamó de vuelta para decirlo | Esto es recepción de verdad |

**El nivel 3 es el objetivo**, y de ahí la importancia de las preguntas 7 y 22. Si
C360 no puede dar el nivel 3, hay que decirlo explícitamente como riesgo asumido:
estaríamos confiando en un 2xx, que es exactamente el tipo de señal que falló en
septiembre.

### El registro nuevo

Hoy el `registro.json` del Blob se escribe **solo cuando el correo falla** y guarda
el estado de una vez, sin volver a tocarse. Tendría que pasar a escribirse
**siempre** y a **actualizarse** a medida que cada canal avanza. En forma, no en
código:

| Campo | Para qué |
| --- | --- |
| `version` | Para poder cambiar la forma del registro sin que lo viejo deje de leerse |
| `id` (`EMP-…`) | El que ya existe. Es también la clave de idempotencia hacia C360 |
| `recibidaEn` | Fecha y hora de recepción |
| Datos del candidato y de la hoja de vida | Los de hoy, sin cambios |
| `verificada` | Si pasó Turnstile. Ya existe |
| **`correo`**: `estado`, `intentos`, `idResend`, `ultimoIntentoEn`, `error` | `estado` ∈ pendiente / aceptado / fallido. `idResend` ya se escribe hoy en el registro de Vercel; aquí quedaría guardado de forma durable |
| **`c360`**: `estado`, `intentos`, `httpStatus`, `idC360`, `enviadoEn`, `confirmadoEn`, `ultimoError` | `estado` ∈ pendiente / aceptado / **confirmado** / fallido / requiere-atención. **`aceptado` y `confirmado` separados a propósito**: son los niveles 1 y 3 de la tabla de arriba y confundirlos es el fallo que queremos evitar |
| `requiereAtencion` | Bandera simple para poder listar de un golpe lo que hay que mirar |

Dos propiedades que este registro tiene y los registros de Vercel no: **es durable**
(no caduca a la hora) y **es consultable** (se puede listar «todo lo pendiente» sin
leer registros a mano).

### El aviso diario: lo que de verdad habría evitado septiembre

Un registro que nadie mira no es vigilancia. Hace falta **un aviso activo**, y
propongo lo más simple que funciona: **un correo diario**, generado por un proceso
programado, con cuatro líneas:

```
Postulaciones del 2026-10-02
  Recibidas:                 7
  Correo a Talento Humano:   7 aceptadas, 0 fallidas
  Control360:                6 confirmadas, 1 pendiente, 0 fallidas
  Requieren atención:        0

  Pendientes de más de 24 h: ninguna
```

Tres detalles que lo hacen útil, y los tres salen de cómo falló septiembre:

- **Llega todos los días, también cuando no hay nada que contar.** Un aviso que
  solo llega cuando hay problemas es indistinguible de un aviso roto. Si el correo
  de hoy no llegó, eso ya es la alerta.
- **Dice el número de recibidas.** Un día con cero postulaciones es información: si
  el formulario se rompió, el cero lo delata. En septiembre, dos semanas de ceros
  no se vieron porque nadie estaba contando.
- **«Requieren atención» es la línea que hay que leer.** Si no es cero, hay
  postulaciones que existen y que C360 no tiene.

Encima de eso, un **aviso inmediato** cuando algo pasa de un umbral: cualquier
postulación con más de N horas sin confirmar, o dos fallos seguidos de C360. El
diario es la red; el inmediato es para no esperar hasta mañana.

> **Aviso sobre el aviso:** el correo diario saldría por **Resend**, que es el mismo
> servicio del que se está vigilando el funcionamiento. Si Resend se cae, se cae
> también la alarma. No es motivo para no hacerlo —es muchísimo mejor que no tener
> nada—, pero sí para tenerlo presente, y es una razón más para verificar el
> dominio (`docs/INVENTARIO-TECNICO.md`, 7.1) y, más adelante, para considerar un
> segundo canal de aviso.

### Lo que hace falta antes de poder hacer esto

Dos cosas del inventario dejan de ser pendientes menores y se vuelven requisitos
de esta integración:

- **`CRON_SECRET`** (7.3). Sin ella **ningún** proceso programado funciona: los
  endpoints de cron responden 503. El reintentador y el aviso diario **no pueden
  existir** hasta que esa variable esté puesta.
- **La retención de hojas de vida** (7.8). Guardar siempre en el Blob exige tener
  resuelto cuándo se borra.

---

## 5. Lo que queda por decidir, y de quién depende

| Decisión | De quién | Qué la desbloquea |
| --- | --- | --- |
| ¿C360 es alcanzable desde la nube de Vercel? | Administrador de C360 | Pregunta 1. **Si la respuesta es no, todo este diseño cambia** |
| ¿Hay lista blanca de IPs? | Administrador de C360 | Pregunta 2. Puede obligar a cambiar de plan en Vercel |
| Cómo viaja el PDF | Acuerdo entre los dos | Pregunta 17 |
| ¿Se puede confirmar la recepción (nivel 3)? | Administrador de C360 | Preguntas 7 y 22. Sin esto, se asume un riesgo y hay que decirlo |
| ¿Hay entorno de pruebas? | Administrador de C360 | Pregunta 24 |
| ¿Se añaden campos al formulario? | Talento Humano + diseño | Pregunta 16 |
| Plazo de conservación de hojas de vida | Negocio | Pregunta 27 + el pendiente 7.8 |
| Cuándo se apaga el correo | Talento Humano | Los criterios de la sección 2 |
| Poner `CRON_SECRET` | Administración del sitio | Nada. Se puede hacer hoy y hace falta de todas formas |

---

## 6. Resumen de una página

1. **Preguntar primero si C360 se puede alcanzar desde internet y si filtra por
   IP.** Las dos respuestas pueden cambiar el proyecto entero, y las funciones de
   Vercel no están en la red de la empresa ni tienen IP fija.
2. **Mover el guardado en el Blob al principio del flujo.** Hoy es la red de
   seguridad; tiene que ser el primer paso. Es lo que hace que ningún fallo de
   entrega cueste una postulación. Obliga a encender la retención.
3. **C360 va al final y no puede hacer fallar nada.** Plazo corto, un reintento,
   nunca decide lo que ve el candidato. El correo sigue funcionando igual durante
   toda la transición.
4. **Un proceso programado reintenta lo pendiente**, con espera creciente, y
   siempre con clave de idempotencia para no duplicar.
5. **Separar «aceptado» de «confirmado» en el registro**, y exigirle a C360 una
   forma de confirmar de verdad: su identificador más una consulta, o un webhook.
   Un 2xx no es recepción.
6. **Un correo diario con los números, todos los días, también los días sin
   novedad.** Es lo que habría convertido las dos semanas de septiembre en un
   aviso del primer día.
7. **`CRON_SECRET` es requisito previo**, no un pendiente aparte: sin ella no hay
   reintentador ni aviso diario.

# Mensaje para quien administra Control360

Listo para reenviar. **Todo lo que está debajo de la línea es el mensaje**; esta
cabecera no se envía.

Tres cosas antes de mandarlo:

- Las **tres primeras preguntas van primero a propósito**. Si la respuesta a la
  primera es «solo desde la red interna», las otras veintitantas dan igual: habría
  que cambiar el enfoque entero. No conviene enterrarlas al final.
- Está escrito **sin jerga**. Cada pregunta dice por qué se hace, para que quien
  responda entienda qué decisión depende de su respuesta y no tenga que adivinar.
- **Pide un ejemplo real** de petición que ya funcione. Suele ahorrar tres correos
  de ida y vuelta: un ejemplo que funciona resuelve dudas que una especificación
  deja abiertas.

El análisis técnico completo del que sale este mensaje está en
`docs/EMPALME-CONTROL360.md`.

---

**Asunto: Integración de las postulaciones de empleo de la página web con Control360 — información que necesitamos**

Buen día,

Estamos preparando la integración entre el formulario de empleos de la página web
(dstunja.com/empleos) y Control360, para que las postulaciones que hoy llegan por
correo a Talento Humano entren directamente al aplicativo.

Todavía no hemos escrito nada: antes de programar necesitamos entender cómo recibe
Control360 esta información, porque hay respuestas que cambian por completo la
forma de hacerlo. Abajo van las preguntas agrupadas, y al lado de cada una el
motivo por el que la hacemos.

Una aclaración que ayuda a entender todo lo demás: **la página web no está alojada
en un servidor de la empresa**. Está en un servicio en la nube (Vercel), y la parte
que recibe las postulaciones corre allí. Es decir, la llamada a Control360 saldría
desde internet, no desde la red interna de la oficina.

---

## Primero lo que puede hacer imposible la integración

Estas tres son las importantes. Si alguna respuesta cierra la puerta, preferimos
saberlo hoy y no después de dos semanas de trabajo.

**1. ¿Control360 se puede alcanzar desde internet, o solo desde la red interna de
la empresa?**

*Por qué preguntamos:* como la página web vive en la nube, si Control360 solo
responde dentro de la red de la oficina o a través de VPN, no podemos llamarlo
directamente. No sería un obstáculo insalvable, pero sí otra forma de trabajar: por
ejemplo, que Control360 sea el que venga a consultar las postulaciones a la página
web, en lugar de que la página se las mande. Son dos diseños distintos y conviene
elegir desde el principio.

**2. ¿Control360 restringe por dirección IP quién le puede hablar?**

*Por qué preguntamos:* es lo normal en un aplicativo interno, y aquí es un
problema concreto. El servicio donde está la página web **no nos da una dirección
IP fija de salida** en el plan actual: cambia. Si hace falta autorizar una IP en una
lista, tendríamos que resolverlo de otra manera (autenticar con una clave en lugar
de por IP, cambiar de plan en el servicio de alojamiento, o pasar por un
intermediario con IP fija). Cualquiera de las tres se puede hacer; lo que no se
puede es descubrirlo a mitad de camino.

**3. ¿Con qué nombre de dominio responde Control360 y quién emitió su certificado
de seguridad?**

*Por qué preguntamos:* si el certificado es propio de la empresa o autofirmado, la
conexión se va a rechazar por seguridad antes de llegar a ningún sitio. Nos sirve
saberlo de antemano para tratarlo, en lugar de perseguir un error raro.

---

## Sobre el punto de entrada

**4.** ¿Cuál es la dirección exacta (URL) a la que hay que enviar una postulación, y
con qué método (asumimos `POST`)?

**5.** ¿Qué espera recibir exactamente? **Si pueden mandarnos un ejemplo real de un
envío que ya haya funcionado** —con sus cabeceras y su contenido completo—, nos
ahorra mucho tiempo y evita malentendidos.

**6.** ¿Qué responde cuando acepta la postulación? En particular: **¿devuelve algún
número o código del registro que creó?**
*Por qué preguntamos:* es la pieza clave para poder comprobar después que la
postulación llegó de verdad. Lo explicamos en el punto 12.

**7.** ¿Qué responde cuando la rechaza? Nos interesa sobre todo **poder distinguir
dos situaciones muy distintas**: «los datos venían mal» (volver a intentarlo no
sirve de nada, hay que corregir) y «estaba ocupado o caído» (volver a intentarlo sí
sirve). Si los dos casos responden igual, no podemos decidir si reintentar.

**8.** ¿Hay un límite de cuántos envíos acepta por minuto? ¿Y qué responde si se
pasa?

---

## Sobre la autenticación

**9.** ¿Cómo tenemos que identificarnos al enviar? Nos sirve cualquiera de las
formas habituales. En orden de preferencia, por lo sencillo que es mantenerlo:

1. Una **clave fija** que viaje en la petición (lo más simple de operar).
2. Usuario y clave **de sistema** con los que se pide un permiso temporal
   (OAuth2 u equivalente).
3. Un **certificado de cliente** (tendríamos que verificar que el entorno lo
   permite tal como está montado hoy).

Lo que preferiríamos **evitar** es usar el usuario y la contraseña de una persona:
el día que a esa persona le cambien la contraseña o se le bloquee la cuenta, la
integración deja de funcionar y nadie lo relaciona con eso.

**10.** ¿Esa credencial caduca? Si caduca, **¿cada cuánto, y quién nos avisa antes?**
*Por qué preguntamos:* una clave que vence sin aviso es la forma más común de que
todo deje de funcionar un martes por la tarde sin que nadie entienda por qué.

**11.** ¿Habría una credencial distinta para pruebas y otra para producción?

---

## Sobre los datos y la hoja de vida

**12.** ¿Qué campos espera, con qué nombres, cuáles son obligatorios y qué
validaciones aplica? Esto es **todo** lo que le pedimos hoy al candidato:

- Nombre completo
- Correo electrónico
- Teléfono (celular colombiano de diez dígitos)
- Cargo al que se postula (de una lista cerrada que publicamos en la página)
- Experiencia (texto libre, **opcional**: puede venir vacío)
- Autorización de tratamiento de datos personales (obligatoria, Ley 1581 de 2012:
  sin marcarla el formulario no envía)
- La hoja de vida: **PDF, DOC o DOCX, hasta 4 MB**
- Más la fecha y hora de recepción, que la ponemos nosotros

**13. ¿Control360 pide algún dato que hoy no estamos pidiendo?** Por ejemplo
documento de identidad, ciudad o fecha de nacimiento.
*Por qué preguntamos:* si es obligatorio en Control360, hay que **añadir ese campo
al formulario de la página**, y eso ya no es trabajo de integración: hay que
diseñarlo, redactarlo y revisar la parte legal. También conviene saber que cada
campo nuevo es un campo más donde un candidato abandona a medias, así que
preferimos pedir solo lo que de verdad se va a usar.

**14. ¿Los cargos tienen un código propio en Control360?** Si lo tienen,
necesitamos la lista de códigos para enviar el código y no el texto. Si no, enviamos
el nombre del cargo tal como aparece publicado en la página.

**15. ¿Cómo prefiere recibir la hoja de vida?** Hay tres formas y cada una tiene su
coste. Nuestra preferencia es la primera, pero nos adaptamos:

- **Un enlace temporal de descarga** (lo que preferimos): les enviamos los datos con
  un enlace, y Control360 descarga el archivo cuando quiera. El envío es muy
  liviano, no se traba y ya tenemos esa parte funcionando. Requiere que Control360
  pueda salir a internet a descargar el archivo.
- **El archivo dentro del mismo envío**, como un formulario con adjunto. Es un solo
  paso, pero el envío puede pesar hasta 4 MB.
- **El archivo convertido a texto dentro de los datos** (base64). Funciona, pero
  **crece un 33 %**: 4 MB se vuelven unos 5,4 MB, y hay que confirmar que
  Control360 acepta envíos de ese tamaño.

**16.** Si es la primera opción: **¿cuánto tiempo necesitan que el enlace siga
sirviendo?** Los nuestros hoy duran siete días. Y al revés: ¿nos pueden avisar
cuando ya descargaron el archivo? Nos serviría para dejar de conservarlo y guardar
menos datos personales de los necesarios.

**17.** ¿Hay un tamaño máximo de envío que acepte Control360?

**18.** Un detalle de nuestro formulario: aceptamos a propósito postulaciones de
candidatos cuyo navegador **no pudo completar la verificación antirrobots** (pasa de
verdad: celulares viejos, el navegador interno de WhatsApp, bloqueadores de
publicidad). Hoy esas postulaciones llegan a Talento Humano marcadas en el asunto
del correo, para que las lean con algo más de criterio. **No quiere decir que sean
falsas.** ¿Quieren que les enviemos ese indicador para mostrarlo también en
Control360?

---

## Para que nada se duplique ni se pierda

**19. ¿Qué pasa si la misma postulación llega dos veces?**

*Por qué preguntamos, y es importante:* **vamos a reintentar los envíos.** Si
Control360 no responde, lo intentamos otra vez más tarde, porque la alternativa es
perder la postulación de una persona. Pero si el primer envío sí se procesó y la
respuesta se perdió en el camino, ese reintento crearía un registro duplicado. Para
evitarlo nos sirve cualquiera de estas dos:

- Que Control360 acepte un **identificador nuestro** en cada envío y, si ya lo vio
  antes, responda lo mismo sin crear otro registro. Es la mejor opción.
- O que Control360 detecte duplicados por su cuenta y nos diga con qué criterio
  (por correo y cargo, por ejemplo).

**20. ¿Hay alguna manera de consultar después una postulación que ya enviamos?**
Por ejemplo, preguntar por el número que nos devolvió y que Control360 confirme que
lo tiene. O, al revés, que Control360 nos avise cuando la haya procesado.

*Por qué preguntamos, y es la pregunta que más nos importa después de las tres
primeras:* que un sistema responda «recibido» no es lo mismo que que el dato quede
guardado y visible. Son dos cosas distintas, y entre las dos es donde se esconden
los problemas que nadie nota. **En septiembre estuvimos dos semanas perdiendo
postulaciones sin darnos cuenta**, y no queremos repetirlo: queremos poder
comprobar todos los días que lo que enviamos está de verdad en Control360, no
solamente que Control360 contestó que sí.

**21. ¿Cuánto tarda normalmente en responder, y cuál es el peor caso que han
visto?**
*Por qué preguntamos:* si la respuesta normal tarda más de unos segundos, no cabe
dentro del mismo momento en que el candidato pulsa «Enviar», y hay que mandarlo en
segundo plano. Se puede hacer perfectamente, pero hay que decidirlo desde el
principio.

---

## Para poder probar sin molestar a nadie

**22. ¿Hay un entorno de pruebas?** Si lo hay: la dirección, su propia credencial,
y sobre todo **si los datos de prueba van a una base separada** de la que usa
Talento Humano.

*Por qué preguntamos:* necesitamos enviar varias postulaciones inventadas para
comprobar que todo funciona, y no queremos ensuciar el aplicativo real. Si no hay
entorno de pruebas, podemos acordar otra forma: una vacante de prueba que luego se
borre, un horario, o un cargo reservado para eso. Lo que preferimos evitar es que la
primera prueba sea con la postulación de una persona de verdad.

**23. ¿A quién avisamos si la integración falla?** Nos sirve un nombre y un canal
concreto (teléfono, correo, grupo), no un buzón general. Por lo de septiembre: el
problema no fue que algo se rompiera, fue que nadie se enteró a tiempo.

**24. ¿Hay horarios de mantenimiento en los que Control360 se apague?** Para no
interpretar como falla algo que es normal.

**25. ¿Qué hace Control360 con la hoja de vida, y cuánto tiempo la conserva?**
*Por qué preguntamos:* la Ley 1581 nos obliga a fijar un plazo y a borrar después.
Si Control360 pasa a ser el archivo definitivo de las hojas de vida, nosotros
podemos dejar de guardarlas antes, que es mejor para todos.

---

## Qué podemos ofrecer de nuestro lado

Para que la conversación no sea solo de pedir:

- Nos adaptamos al formato que Control360 ya tenga. **No necesitamos que se
  construya nada nuevo** si ya existe una forma de cargar postulaciones.
- Enviamos un identificador único por postulación, para que los reintentos no
  dupliquen nada.
- Mientras dure la transición, **las postulaciones van a seguir llegando también
  por correo a Talento Humano**, igual que hoy. Nada se apaga hasta que Control360
  esté recibiendo bien y confirmado.
- Guardamos cada postulación en nuestro propio almacenamiento antes de enviarla, así
  que **si Control360 está caído no se pierde nada**: se reenvía cuando vuelva.

Quedamos atentos. Si es más fácil, podemos verlo en una llamada corta y dejar las
respuestas por escrito después.

Gracias,

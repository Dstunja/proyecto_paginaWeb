# Plan: verificar dstunja.com y dejar el correo en condiciones

Documento de retomar. El trabajo está parado esperando **los registros DNS de
dstunja.com en Hostinger**; cuando estén, se siguen los pasos de abajo en orden.

**No es una emergencia.** El 30/09/2026 se comprobó que la entregabilidad
funciona hoy: tres correos de prueba llegaron a **Recibidos** (no a spam) de
`ghsantiagodetunja@gmail.com`, remitente `onboarding@resend.dev`, uno con su
adjunto de 1 MB. Lo de abajo no arregla algo roto: quita tres deudas que hoy se
están pagando en silencio.

## Por qué se hace

1. **La constancia de PQRS no se envía nunca.** Con un remitente `@resend.dev`,
   Resend solo entrega al titular de la cuenta, y quien radica nunca lo es. El
   código lo sabe y ni lo intenta (`constancia: 'omitida'`). Viene así desde el
   **07/09/2026**, el día que la radicación entró en producción.
2. **Reputación.** `onboarding@resend.dev` funciona, pero es un remitente
   compartido y sin relación con el dominio: hoy entrega, y puede dejar de
   hacerlo cualquier día sin avisar y sin que nadie se entere.
3. **Dos cuentas de Resend que no pueden coexistir con el dominio.** Cada una
   publicaría su propia clave DKIM en el mismo nombre,
   `resend._domainkey.dstunja.com`. Hay que quedarse con una.

## Estado comprobado el 30/09/2026

| Cosa | Estado |
| --- | --- |
| Entregabilidad actual | **Funciona.** Llega a Recibidos desde `onboarding@resend.dev` |
| dstunja.com: SPF, DKIM, DMARC | **No existen.** Ni un TXT en el dominio |
| dstunja.com: MX en la raíz | **No existen.** El dominio no puede *recibir* correo |
| DNS del dominio | Hostinger (`nova.dns-parking.com`, `cosmos.dns-parking.com`) |
| Cuentas de Resend | **Dos**: Empleos (`RESEND_API_KEY`) y PQRS (`PQRS_RESEND_API_KEY`) |
| Constancia de PQRS | **Nunca enviada** desde el 07/09/2026 |
| `EMPLEOS_DESTINO`, `EMPLEOS_REMITENTE` | Cargadas en Production desde el 14/09; valores sin leer |

## Los pasos

Entre cada paso hay algo que comprobar. **Si una comprobación falla, se para y
se vuelve atrás**: cada paso es reversible por sí solo, la suma de dos no.

### 0. Publicar los registros DNS

En **Resend → Domains → Add Domain → `dstunja.com`**, y en la **cuenta de
`RESEND_API_KEY`** (ghsantiagodetunja@gmail.com), que es la que se queda. Los
valores exactos los da la pestaña *Records*; se pegan en Hostinger: hPanel →
Dominios → dstunja.com → DNS / Nameservers → Administrar registros DNS. La forma
de los registros está en `docs/PQRS-ADJUNTOS.md`, «Qué registros DNS pide Resend».

> **Comprobar:** `npm run verificar:correo` da los tres obligatorios en verde, y
> Resend dice **Verified**. El script consulta al DNS público y no necesita
> ninguna credencial, así que lo puede correr cualquiera.

### 1. Remitente de Empleos

`EMPLEOS_REMITENTE=empleos@dstunja.com` en Vercel (Production). **Redesplegar**:
cambiar una variable no afecta a los despliegues que ya existen.

> **Comprobar:** una postulación de prueba y, en la misma hora,
> `npx vercel logs --environment production --since 10m --search "empleos/postular"`.
> Tiene que salir `enviada` con `intentos:1` y su `idResend`. Y el correo, **en
> Recibidos**, con remitente `empleos@dstunja.com`.
> **Si sale `enviada:con-enlace`, `intentos` mayor que 1, o la respuesta trae
> `referencia`: parar y volver atrás.** El dominio no está firmando bien.

### 2. Destino de Empleos

`EMPLEOS_DESTINO=<buzón de Talento Humano>`. Redesplegar.

> **Comprobar:** lo mismo que en el paso 1, y que llega al buzón nuevo.

### 3. Remitente de PQRS

`PQRS_REMITENTE=pqrs@dstunja.com`. Redesplegar.

> **Comprobar:** radicar una PQRS de prueba. La respuesta de `POST /api/pqrs` lo
> dice todo sin mirar registros: `correoArea: true` **y `constancia: "enviada"`**
> en vez de `"omitida"`. Aquí es donde **la constancia al ciudadano vuelve sola**,
> sin tocar código.
> Ojo: la PQRS de prueba **hay que radicarla desde un navegador normal**.
> Turnstile no entrega token a un navegador automatizado, así que no se puede
> hacer con un script.

### 4. Borrar `PQRS_RESEND_API_KEY`

Solo después del paso 3. Borrarla en Vercel y redesplegar. No hay que tocar
código: `claveResend()` ya cae a `RESEND_API_KEY`.

> **Comprobar:** otra PQRS de prueba, con `correoArea: true` y
> `constancia: "enviada"` otra vez. Si sale `correoArea: false`, **volver a poner
> la variable**: significa que el dominio no está verificado en la cuenta que quedó.

**Por qué este paso va al final y no antes:** mientras `PQRS_REMITENTE` sea el
remitente de pruebas, borrar la variable haría que PQRS firmara con la cuenta de
Empleos hacia un buzón que esa cuenta no puede alcanzar, y **todos** los avisos
al área fallarían en silencio — el radicado se guarda en el Blob antes de enviar,
así que quien radica seguiría viendo su número y nadie en el área se enteraría.
`yaSePuedeBorrarLaClaveDePqrs()` avisa en el registro cuando llega el momento
seguro, y no antes.

### 5. Destino de PQRS y DMARC

`PQRS_DESTINO` al buzón definitivo, si cambia. Y un TXT en `_dmarc` con
`v=DMARC1; p=none; rua=mailto:<un buzón que se lea>`: con `p=none` no se rechaza
nada, solo se informa, que es como se empieza.

> **Comprobar:** `npm run verificar:correo` da también el DMARC en verde.

## Lo que este plan NO hace

- **No crea ningún buzón `@dstunja.com`.** Verificar el dominio en Resend
  habilita **enviar**, no **recibir**. La raíz no tiene MX; un buzón del dominio
  para Talento Humano es otra contratación (Google Workspace, el correo de
  Hostinger) con sus propios MX. Si el buzón sigue siendo un Gmail, no hace falta.
- **No toca `astro.config.mjs`** ni nada de dónde se publica el sitio.
- **No toca el formulario de Contáctanos**, que hoy abre el gestor de correo con
  un `mailto:` y tiene el defecto que ya se corrigió en Empleos (en un celular sin
  app de correo no abre nada). Está propuesto y aparcado a propósito: con el
  dominio verificado, ese endpoint nacería pudiendo mandar acuse de recibo.

## Pendiente aparte, no bloquea nada

- **`www.dstunja.com` no funciona.** El certificado que sirve solo cubre
  `dstunja.com` (SAN `DNS:dstunja.com`), así que un navegador que entre por `www`
  da aviso de seguridad y no llega al sitio. Hay una redirección 307 de `www` al
  apex configurada, pero es inalcanzable: el TLS falla antes. Se arregla añadiendo
  `www.dstunja.com` como dominio en Vercel, que emite el certificado y mantiene la
  redirección. Comprobado el 30/09/2026.
- **Los registros de ejecución de Vercel duran una hora** en el plan Hobby, así
  que no sirven de historial. El historial que sí existe es el buzón: cada
  postulación deja un correo con asunto `Postulación: …`. Hay propuesta de llevar
  un registro mínimo propio (Supabase o el Blob) y de recoger el estado de entrega
  con un webhook de Resend; está aparcada.

## Comandos

```
npm run verificar:correo                  # ¿están los registros DNS? (solo DNS, sin credenciales)
npm run verificar:correo -- --dominio X   # el mismo, sobre otro dominio
npx vercel logs --environment production --since 10m --search "empleos/postular"
npx vercel env ls production              # qué variables hay (no enseña los valores)
```

# Acuario NFC

Aplicación web independiente para registrar alimentación, cambios de agua,
parámetros, fertilización y mantenimiento de dos filtros mediante etiquetas NFC.

## Arquitectura

- Next.js en Vercel.
- PostgreSQL en Supabase.
- Enlaces privados por acuario mediante un identificador aleatorio incluido en
  cada URL NFC.

## Puesta en marcha

1. Crea un proyecto gratuito en Supabase.
2. Abre **SQL Editor**, pega `supabase/schema.sql` y ejecútalo.
3. Copia `Project URL` y la clave `service_role` desde la configuración de API.
4. Despliega esta carpeta en Vercel.
5. Añade las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
6. Abre la URL desplegada, pulsa **NFC** y copia los siete enlaces.

## Alimentación NFC automática

El menú **NFC** incluye `Alimentar automáticamente`. Ese enlace apunta al
endpoint `POST /api/scan` y está pensado para una automatización NFC de Atajos
en iPhone o MacroDroid en Android. La petición:

- registra la primera alimentación del día sin abrir la web;
- responde con un mensaje breve para la notificación del teléfono;
- impide una segunda alimentación durante el mismo día natural en
  `Europe/Madrid`.

Los enlaces NFC normales se mantienen para abrir manualmente los formularios.

La clave `SUPABASE_SERVICE_ROLE_KEY` es secreta: solo debe guardarse como
variable de entorno en Vercel y nunca escribirse dentro del código ni enviarse
por chat.

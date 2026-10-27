# Saga Quest

Tu registro de videojuegos, al estilo de IGN Playlist pero con estética cyberpunk / Persona y seis estéticas más. Guarda lo que juegas, ponle nota, apunta en qué plataforma lo jugaste, escribe tu reseña y organiza tus juegos en bibliotecas (carpetas) públicas o privadas, ordenadas a mano.

## Descargar

**[Última APK para Android](../../releases/latest)**: descarga `SagaQuest.apk` en el móvil y ábrela. Cada push a `main` compila una APK nueva con GitHub Actions.

## Qué hace

Funciona como **IGN Playlist** (mismas pantallas, menús y navegación) con las estéticas de Saga Quest.

- **4 pestañas como IGN**: Descubrir, Biblioteca, Listas y Perfil. Títulos grandes que se encogen al bajar.
- **Descubrir**: listas destacadas (las canónicas de cada saga), mejor valorados del año, lo que se juega esta semana (numerado), próximos lanzamientos y listas de la comunidad. Botón «Añadir ⊕» en cada portada.
- **Biblioteca**: «Jugando ahora» y la tarjeta de estados (Mis juegos, Deseados, Pendientes, Jugando, En pausa, Terminados, Abandonados) con su contador; cada una abre su rejilla con orden.
- **Listas**: actualizadas recientemente (mosaico de portadas), Mis listas y Listas que sigues. Cada lista: cabecera con mosaico, autor, desplegable «Ordenar» con las 13 ordenaciones de IGN (orden del autor, actualizados, A-Z, Z-A, nota de la crítica, lanzamiento, duración y tus notas, en los dos sentidos), estadísticas (juegos · horas · pública/privada) y rejilla de 2 columnas con número y estado.
- **Editar lista**: ajustes plegables y juegos que se reordenan **arrastrando el asa**.
- **Ficha de juego**: portada con su estado, nota de la crítica, tu nota, nota de los jugadores, «Editar estado» y «•••» (organizar en listas, plataforma, reseña, más detalles, compartir y atajos de estado). Pestañas Resumen (cuánto dura, tu partida, tu reseña, imágenes y vídeo, datos), Listas y Reseñas.
- **Reseña en 5 pasos** como IGN: nota del 1 al 10 con barra, recomendar, plataforma, qué te gustó y qué no, texto con spoilers, resumen con opción privada y pantalla para compartir.
- **Buscador tolerante**: encuentra el juego aunque escribas mal o a medias («minecraf», «fire emblem blazing blaze», «zelda breath wild»). Busca de varias maneras en IGDB y RAWG a la vez y ordena por parecido.
- **Bibliotecas oficiales** (públicas): Persona, Fire Emblem, Final Fantasy, The Legend of Zelda, Kirby, Super Mario, Xenoblade y Metroid. Solo los canónicos, en su mejor versión jugable (src/data/canon.ts); todos los datos llegan de la API.
- **Comunidad**: las listas públicas de otros se pueden seguir o copiar a tu perfil.
- **Cuentas**: varios perfiles en el mismo móvil y, con Supabase, cuentas reales.
- **Todos los juegos que existen**: API de **IGDB** y **RAWG** con las claves dentro de la app.
- Juegos creados a mano, **7 estéticas** y copia de seguridad.

## Claves de la API (solo una vez, para quien compila)

Las claves de IGDB, RAWG y Steam **no van dentro de la APK ni de la web** (se podrían sacar de ellas): las guarda el servidor intermedio de Supabase (`supabase/functions/games`) y la app le pide los datos a él.

1. Supabase → **Edge Functions → games**: pega `supabase/functions/games/index.ts` y pulsa **Deploy** (con «Verify JWT» desactivado).
2. Supabase → **Edge Functions → Secrets**: `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` (dev.twitch.tv/console), `RAWG_KEY` (rawg.io/apidocs) y `STEAM_API_KEY` (steamcommunity.com/dev/apikey).
3. GitHub → **Settings → Secrets and variables → Actions**: `SUPABASE_URL` y `SUPABASE_ANON_KEY` (y, para firmar la APK, `ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD`).

El servidor intermedio solo acepta la web de Saga Quest desde navegadores, limita las peticiones por IP y solo deja pasar las consultas que usa la app.

## Seguridad

- **Datos**: cada tabla tiene normas RLS (nadie lee lo privado de otro ni toca lo que no es suyo). La app solo lleva la clave pública *anon*; la de servicio nunca sale del panel de Supabase.
- **Inyección SQL**: la app no escribe SQL; todo va por la API de Supabase con parámetros, y las funciones de la base de datos no montan SQL con texto del usuario.
- **Abusos**: la base de datos limita el ritmo (juegos creados, listas, mensajes, solicitudes de amistad, retos, intercambios, denuncias) y el tamaño de textos y ajustes (`supabase/migrations/2026-10-28-seguridad.sql`).
- **Moderación**: cualquiera puede denunciar o bloquear a otra persona desde su perfil. Los administradores ven las denuncias en **Ajustes → Administración**.
- **Actualizaciones**: la app avisa de cada versión nueva; si una es obligatoria, en **Ajustes → Administración** se pone la compilación mínima y las APK más viejas piden actualizar.

**Antes de publicar (en tus cuentas):**

- GitHub y Supabase con verificación en dos pasos. En GitHub: Settings → Code security → activa «Dependabot alerts» y «Dependabot security updates»; en Settings → Branches protege `main` (sin borrar ni forzar).
- Supabase → Authentication: confirmar correo activado, «Leaked password protection» y un CAPTCHA (Cloudflare Turnstile o hCaptcha) en el registro; revisa los límites de Auth → Rate Limits.
- Supabase **Pro** cuando haya usuarios de verdad: no se pausa, copias diarias y más capacidad.
- Política de privacidad y condiciones de uso (obligatorias en Google Play y en la UE).

## Base de datos (Supabase)

Todo se guarda en Supabase: tu perfil y tus ajustes, tus listas (públicas y privadas) con su orden, tu biblioteca (estado, nota, plataforma, horas, fechas, reseña…) y las listas que sigues. Hay que crear una cuenta sí o sí (con correo y contraseña o con Google) y elegir tu usuario la primera vez; con la misma cuenta ves tu progreso en cualquier dispositivo.

1. **SQL Editor** → ejecuta `supabase/schema.sql` (tablas, normas RLS, borrar cuenta y tiempo real) y después `supabase/seed.sql` (las 8 bibliotecas oficiales). Los dos se pueden volver a ejecutar sin perder datos.
2. **Authentication → Sign In / Providers → Email**: desactiva «Confirm email» si quieres entrar nada más registrarte. Si lo dejas activado, el usuario confirma desde el correo y luego entra.
3. **Authentication → Emails → Reset Password**: añade `{{ .Token }}` a la plantilla para que la app pueda cambiar la contraseña con un código.
4. **Google**: en Google Cloud crea un *ID de cliente de OAuth* de tipo *Aplicación web* con la URI de redirección `https://<tu-proyecto>.supabase.co/auth/v1/callback`; en Supabase, **Authentication → Sign In / Providers → Google**, actívalo y pega el Client ID y el Client Secret; en **Authentication → URL Configuration → Redirect URLs** añade `sagaquest://auth-callback`.
5. **Project Settings → API**: copia la *Project URL* y la clave *anon public* y guárdalas en GitHub (Settings → Secrets and variables → Actions) como `SUPABASE_URL` y `SUPABASE_ANON_KEY`. El siguiente APK ya va conectado.

**Actualizar una base de datos que ya tienes**: ejecuta en el SQL Editor los archivos de `supabase/migrations/` que aún no hayas ejecutado, por orden de fecha (todos se pueden repetir sin problema). El de cromos (`2026-10-26-cromos.sql`) crea los cromos, los sobres diarios y los intercambios; el azar lo pone la base de datos, así que nadie puede fabricarse cromos.

**Servidor intermedio de la web** (`supabase/functions/games`): si cambias este archivo, vuelve a desplegarlo (Edge Functions → games → pega el archivo → Deploy). La versión actual añade los precios de Steam y CheapShark para la pantalla de ofertas.

La clave *anon* es pública por diseño: lo que protege los datos son las normas Row Level Security (las listas privadas solo las lee su dueño y nadie puede cambiar lo de otro).

**Cómo se guarda**: la app escribe primero en el móvil y lo sube a Supabase enseguida. Cada subida se comprueba; si falla (sin red, error), el cambio queda pendiente y se reintenta al volver la conexión. Al abrir la app, al volver internet o si cambias algo en otro móvil (tiempo real), se descarga lo último sin pisar lo que tengas pendiente.

**Sin conexión**: la app lo detecta sola y pasa al modo perfil (solo tu biblioteca y tus listas; Descubrir, buscar y las listas de otros se desactivan). Para tener tu perfil en el móvil sin internet, descárgalo desde **Perfil → Usar sin conexión** (opcional; también se puede borrar la descarga para liberar espacio). Lo que cambies sin conexión se sube al volver.

## Desarrollo

```bash
npm install
npx expo start        # Expo Go o build de desarrollo
npm test              # tests de la lógica y del almacén
npx tsc --noEmit      # tipos
npx eslint src        # lint
```

Stack: React Native 0.86 + Expo SDK 57, Expo Router, TypeScript estricto, Zustand con persistencia, Supabase JS, expo-image, expo-secure-store y Jest.

```
src/app          pantallas (cada archivo es una ruta; (tabs) son las pestañas)
src/components   componentes (tarjetas de carpeta, filas de juego, selectores…)
src/store        estado local persistente (perfiles, biblioteca, listas)
src/cloud        Supabase: cliente, conversión de filas y sincronización
src/api          IGDB
src/data         qué series son oficiales y metadatos (sin juegos)
src/utils        lógica pura con sus tests
supabase         esquema SQL con RLS y datos iniciales
```

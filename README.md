# Lecciones — Curso PWA

PWA personal de estudio, vanilla HTML/JS sin build, pensada para servirse
directamente desde GitHub Pages en este repo (p. ej.
`afc1204-coder.github.io/Lecciones/curso.html`).

## Estructura

- `curso.html` — shell de la app (entrada real de la PWA).
- `index.html` — redirección a `curso.html` para quien abra la raíz del repo.
- `css/styles.css` — estilos, responsive, tema claro/oscuro por `prefers-color-scheme`.
- `js/supabaseClient.js` — cliente de Supabase (URL + publishable key del proyecto "lecciones").
- `js/auth.js` — login por enlace mágico (email OTP).
- `js/energia.js` — pantalla de energía 1-10 al abrir sesión; crea la fila en `curso_sesiones`.
- `js/unidad.js` — flujo de unidad nueva (8 pantallas) para el siguiente concepto sin ancla.
- `js/repaso.js` — lista de `curso_repaso` con `proximo_repaso <= now()`.
- `manifest.json`, `sw.js`, `icons/` — instalabilidad PWA y cache de shell (sin offline completo).

## Backend

Supabase, proyecto "lecciones" (`https://rwxbbyuilyvmmywkyboc.supabase.co`).
Esquema y RLS ya aplicados fuera de este repo; este código solo lee/escribe
contra las tablas `curso_*` existentes, respetando las políticas por `user_id`.

## Desarrollo local

Sin build. Basta servir el directorio con cualquier servidor estático, p. ej.:

```bash
python3 -m http.server 8000
```

y abrir `http://localhost:8000/curso.html`.

## Despliegue

GitHub Pages sobre este repo (Settings → Pages → Deploy from a branch),
sirviendo la raíz. No hay paso de build.

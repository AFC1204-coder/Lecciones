const CACHE_NAME = "curso-shell-v1";
const SHELL_FILES = [
  "./curso.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/energia.js",
  "./js/unidad.js",
  "./js/repaso.js",
  "./js/supabaseClient.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Solo cacheamos el shell propio (mismo origen). Todo lo demás
  // (Supabase, CDN de mermaid) va directo a red: no queremos servir
  // datos ni scripts de terceros desde una caché desactualizada.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});

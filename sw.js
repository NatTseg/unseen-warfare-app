// Offline cache. Bump CACHE whenever any listed file changes.
const CACHE = "unseen-warfare-v12";
const ASSETS = ["./", "./index.html", "./styles.css", "./book.js", "./app.js", "./book-data.enc.json", "./manifest.webmanifest",
  "./icon.svg", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("unseen-warfare-") && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
// Serve the cached copy at once and refresh it in the background, so edits appear on the next visit.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request, {ignoreSearch: true});
    const network = fetch(request).then(response => {
      if (response.ok && response.type === "basic") cache.put(request, response.clone());
      return response;
    });
    if (cached) { event.waitUntil(network.catch(() => {})); return cached; }
    return network.catch(() => request.mode === "navigate" ? cache.match("./index.html") : Response.error());
  }));
});

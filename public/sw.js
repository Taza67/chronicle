/* Chronicle service worker — offline game shell + static asset SWR cache.
 * Bump CACHE_VERSION to force clients to drop the old caches on activate. */
const CACHE_VERSION = "v1";
const STATIC_CACHE = `chronicle-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `chronicle-runtime-${CACHE_VERSION}`;

/* Precached at install: the app shell. Hashed JS/CSS bundles are picked up by
 * the runtime SWR handler on first visit instead. */
const PRECACHE = ["./", "./manifest.webmanifest", "./favicon.svg"];

/* Requests that must always hit the network: the worker API (POST, uncacheable
 * anyway), and anything non-GET. TTS/Gemini results already degrade offline. */
const isApiCall = (url) =>
	url.pathname.startsWith("/api/") || url.hostname.endsWith(".workers.dev");

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(STATIC_CACHE)
			.then((c) => c.addAll(PRECACHE))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
						.map((k) => caches.delete(k)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (isApiCall(url)) return;

	// HTML navigations: network-first, fall back to the cached shell offline.
	if (request.mode === "navigate") {
		event.respondWith(fetch(request).catch(() => caches.match("./")));
		return;
	}

	// Static assets (bundles, art, music, chapter JSON, fonts): SWR.
	if (
		url.origin === self.location.origin ||
		url.hostname === "fonts.googleapis.com" ||
		url.hostname === "fonts.gstatic.com"
	) {
		event.respondWith(
			caches.open(RUNTIME_CACHE).then(async (cache) => {
				const cached = await cache.match(request);
				const refreshed = fetch(request)
					.then((r) => {
						if (r.ok) cache.put(request, r.clone());
						return r;
					})
					.catch(() => null);
				return cached ?? refreshed;
			}),
		);
	}
});

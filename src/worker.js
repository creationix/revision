
// import { load } from "./cas";
import { run } from "./async";

function wrap(gen) {
  return function (event) {
    event.waitUntil(run(gen(event)));
  };
}

self.addEventListener('install', wrap(function* () {
  let cache = yield caches.open('v1');
  yield cache.addAll([
    '/',
    '/main.js',
    '/worker.js',
    '/themes/dark-ui.css'
  ]);
  yield self.skipWaiting();
}));

self.addEventListener('activate', wrap(function* () {
  yield self.clients.claim();
}));

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        console.log("Loading from cache...", event.request, response);
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

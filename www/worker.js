(function () {
'use strict';

// Usage: async(function* (...args) { yield promise... })(..args) -> Promise
function run(iter) {
  try { return handle(iter.next()); }
  catch (ex) { return Promise.reject(ex); }
  function handle(result){
    if (result.done) return Promise.resolve(result.value);
    return Promise.resolve(result.value).then(function (res) {
      return handle(iter.next(res));
    }).catch(function (err) {
      return handle(iter.throw(err));
    });
  }
}

// import { load } from "./cas";
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

}());
//# sourceMappingURL=worker.js.map

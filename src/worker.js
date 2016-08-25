import { run } from "./async";
import { Link } from "./link";
import { guess } from "./mime";

const CACHE_NAME = 'v1';
const routePattern = /\/([0-9a-f]{64})(\/.*)$/;

function wrap(gen) {
  return function (event) {
    event.waitUntil(run(gen(event)));
  };
}

self.addEventListener('install', wrap(function* () {
  let cache = yield caches.open(CACHE_NAME);
  yield cache.addAll([
    '/',
    '/index.html',
    '/main.js',
    '/worker.js',
    '/css/dark-theme.css',
    '/css/revision-icons-embedded.css'
  ]);
  yield self.skipWaiting();
}));

self.addEventListener('activate', wrap(function* () {
  yield self.clients.claim();
}));


self.addEventListener('fetch', function (event) {
  return event.respondWith(run(function* () {
    let match = event.request.url.match(routePattern);
    if (!match) return fetch(event.request);
    let root = new Link(match[1]),
        path = match[2];
    return yield* serve(root, path);

  }()));
});

function* passthrough(event) {
  // IMPORTANT: Clone the request. A request is a stream and
  // can only be consumed once. Since we are consuming this
  // once by cache and once by the browser for fetch, we need
  // to clone the response.
  let response = yield fetch(event.request.clone());

  // Check if we received a valid response
  if(!response || response.status !== 200 || response.type !== 'basic') {
    return response;
  }

  // IMPORTANT: Clone the response. A response is a stream
  // and because we want the browser to consume the response
  // as well as the cache consuming the response, we need
  // to clone it so we have two streams.
  var responseToCache = response.clone();

  let cache = yield caches.open(CACHE_NAME);
  yield cache.put(event.request, responseToCache);
  return response;
}

function* serve(root, path) {
  let node = yield* root.resolve();
  let part;
  for (part of path.split('/')) {
    if (!part) continue;
    node = node[part];
    if (!node) {
      return new Response(`No such path: ${path}`);
    }
  }
  if (node instanceof Link) {
    // Render file
    let body = yield* node.resolve();
    return new Response(body, {
      headers: {
        'Content-Type': guess(path),
        'Content-Disposition': `inline; filename="${part}"`
      }
    });
  }
  let html = `<h1>${path}</h1>`;
  html += "<ul>";
  for (let name in node) {
    let newPath = path + (path[path.length - 1] === '/' ? '' : '/') + name;
    let entry = node[name];
    if (entry.constructor === Object) {
      newPath += "/";
    }
    let href = `/${root.toHex()}${newPath}`;
    html += `<li><a href="${href}">${name}</a></li>`;
  }
  html += "</ul>";

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

import { run } from "./async";
import { guess } from "./mime";
import { pathJoin } from "./pathjoin";
import { Link } from "./cas-idb"

const CACHE_NAME = 'v1';
const routePattern = /^https?:\/\/[^\/]+\/([0-9a-f]{40})(\/.*)$/;

function wrap(gen) {
  return function (event) {
    event.waitUntil(run(gen(event)));
  };
}

self.addEventListener('install', wrap(function* () {
  let cache = yield caches.open(CACHE_NAME);
  yield cache.addAll([
    '/',
    '/main.js',
    '/worker.js',
    '/maquette.min.js',
    '/css/dark-theme.css',
    '/css/style.css',
    '/css/revision-icons.css'
  ]);
  yield self.skipWaiting();
}));

self.addEventListener('activate', wrap(function* () {
  yield self.clients.claim();
}));


self.addEventListener('fetch', function (event) {
  return event.respondWith(run(function* () {
    let match = event.request.url.match(routePattern);
    if (!match) return yield* passthrough(event);
    let root = new Link(match[1]),
        path = match[2];
    return yield* serve(root, path);

  }()));
});

function* passthrough(event) {
  let cache = yield caches.open(CACHE_NAME);
  let response = yield cache.match(event.request);
  if (!response) {
    response = yield fetch(event.request.clone());
    if(response && response.status === 200 && response.type === 'basic') {
      var responseToCache = response.clone();
      yield cache.put(event.request, responseToCache);
    }
  }
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

  // Serve files directly with guessed mime-type
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

  // Resolve symlinks by redirecting internally to target.
  if (typeof node === "string") {
    return yield* serve(root, pathJoin(path, "..", node));
  }

  // Render HTML directory for trees.
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

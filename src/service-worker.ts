import { guess } from "./libs/mime";
import { pathJoin } from "./libs/pathjoin";
import { Link } from "./libs/link"
import "./libs/cas-idb"

const CACHE_NAME = 'v1';
const routePattern = /^https?:\/\/[^\/]+\/([0-9a-f]{40})(\/.*)$/;

function wrap(fn) {
  return function (event) {
    event.waitUntil(fn(event));
  };
}

self.addEventListener('install', wrap(async function () {
  let cache = await caches.open(CACHE_NAME);
  await cache.addAll([
    '/',
    '/main.js',
    '/worker.js',
    '/maquette.min.js',
    '/css/dark-theme.css',
    '/css/style.css',
    '/css/revision-icons.css'
  ]);
  await self.skipWaiting();
}));

self.addEventListener('activate', wrap(async function () {
  await self.clients.claim();
}));


self.addEventListener('fetch', function (event) {
  return event.respondWith(async function () {
    let match = event.request.url.match(routePattern);
    if (!match) return await passthrough(event);
    let root = new Link(match[1]),
        path = match[2];
    return await serve(root, path);

  }());
});

async function passthrough(event) {
  let cache = await caches.open(CACHE_NAME);
  let response = await cache.match(event.request);
  if (!response) {
    response = await fetch(event.request.clone());
    if(response && response.status === 200 && response.type === 'basic') {
      var responseToCache = response.clone();
      await cache.put(event.request, responseToCache);
    }
  }
  return response;
}

async function serve(root, path) {
  let node = await root.resolve();
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
    let body = await node.resolve();
    return new Response(body, {
      headers: {
        'Content-Type': guess(path),
        'Content-Disposition': `inline; filename="${part}"`
      }
    });
  }

  // Resolve symlinks by redirecting internally to target.
  if (typeof node === "string") {
    return await serve(root, pathJoin(path, "..", node));
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

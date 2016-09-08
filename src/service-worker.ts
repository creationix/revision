/// <reference path="typings/lib.webworker.d.ts"/>
import { guess } from "./libs/mime";
import { pathJoin } from "./libs/pathjoin";
import { loadTree, loadBlob } from "./libs/link"
import { isUTF8, binToStr } from "./libs/bintools"
import { treeMode, blobMode, symMode, execMode } from "./libs/git-codec"
import "./libs/cas-idb"

const CACHE_NAME = 'v1';
const routePattern = /^https?:\/\/[^\/]+\/([^\/]+)\/([0-9a-f]{40})(\/?.*)$/;

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
    '/download-worker.js',
    '/upload-worker.js',
    '/github-worker.js',
    '/service-worker.js',
    "/pure-min.css",
    "/grids-responsive-min.css",
    "/css/style.css",
    "/css/revision-icons.css",
    "/css/dark-theme.css",

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
    let name = match[1],
        hash = match[2],
        path = match[3];
    return await serve(name, hash, path);
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

async function serve(rootName: string, rootHash: string, path: string) {
  let entry = {
    name: rootName,
    mode: treeMode,
    hash: rootHash
  };
  outer: for (let part of path.split('/')) {
    if (entry.mode === treeMode) {
      if (!part) continue outer
      for (let child of await loadTree(entry.hash)) {
        if (child.name === part) {
          entry = child
          continue outer
        }
      }
      return new Response(`No such entry: ${part}\n`, { status: 404});
    }
    return new Response(`Not a directory: ${entry.name}\n`, { status: 404});
  }

  if (entry.mode === treeMode) {
    if (path[path.length - 1] !== "/") {
      // redirect to add slash
      return new Response("Redirecting...\n", {
        status: 302,
        headers: {
          Location: `/${rootName}/${rootHash}${path}/`
        }
      });
    }
    let tree = await loadTree(entry.hash);

    // Auto load index.html if found
    for (let child of tree) {
      if (child.name === "index.html" && child.mode !== treeMode) {
        entry = child;
        path = pathJoin(path, "index.html")
        break;
      }
    }

    // Render HTML directory for trees.
    if (entry.mode === treeMode) {
      let html = `<h1>${rootName} - ${path}</h1>`;
      html += "<ul>";
      for (let child of tree) {
        let newPath = pathJoin(path, child.name);
        if (child.mode === treeMode) newPath += "/";
        let href = `/${rootName}/${rootHash}${newPath}`;
        html += `<li><a href="${href}">${child.name}</a></li>`;
      }
      html += "</ul>";
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // Resolve symlinks by redirecting internally to target.
  if (entry.mode === symMode) {
    let target = binToStr(await loadBlob(entry.hash))
    return serve(rootName, rootHash, pathJoin(path, "..", target));
  }

  // Serve files as static content
  // TODO: later we can execute files with exec bit set for virtual server code
  if (entry.mode === blobMode || entry.mode == execMode) {
    let body = await loadBlob(entry.hash)
    return new Response(body, {
      headers: {
        'Content-Type': guess(path, ()=>isUTF8(body)),
        'Content-Disposition': `inline; filename="${entry.name}"`
      }
    });
  }

}

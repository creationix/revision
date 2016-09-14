/// <reference path="./typings/service_worker_api.d.ts"/>
import { serve } from "./libs/serve"
import "./libs/cas-idb"

const CACHE_NAME = 'v1';
const routePattern = /^https?:\/\/[^\/]+\/([^\/]+)\/([0-9a-f]{40})(\/?.*)$/;

let cacheStorage : CacheStorage = self.caches;

function wrap(fn) {
  return function (event) {
    event.waitUntil(fn(event));
  };
}

self.addEventListener('install', wrap(async function () {

  let cache = await cacheStorage.open(CACHE_NAME);
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
    let res = await serve(name, hash, path);
    return new Response(res.body, res);
  }());
});

async function passthrough(event) {
  let cache = await cacheStorage.open(CACHE_NAME);
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

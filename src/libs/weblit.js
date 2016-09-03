/*global module*/
import { createServer as createNetServer } from "net";
import { request as nodeRequest } from "https";
import { parse as urlParse } from "url";
import { run } from "./async";
import { makeRead, makeWrite } from "./gen-channel";
import { decoder, encoder } from "./http-codec";
import { encode, decode, acceptKey } from "./websocket-codec";
import { flatten } from "./bintools";
import { sha1 } from "./sha1";
import { readFile as readFileNode } from "fs";
import { guess } from "./mime"
import { pathJoin } from "./pathjoin";
import { compileRoute, compileGlob, parseQuery } from "./weblit-tools";

class Headers {
  constructor(raw) {
    raw = raw || [];
    this.entries = [];
    this.indexes = {};
    for (let i = 0, l = raw.length; i < l; i += 2) {
      this.add(raw[i], raw[i + 1]);
    }
  }
  indexOf(name) {
    name = name.toLowerCase();
    if (this.indexes.hasOwnProperty(name)) return this.indexes[name];
    return -1;
  }
  has(name) {
    return this.indexes.hasOwnProperty(name.toLowerCase());
  }
  // Get the first header matching name
  get(name) {
    let index = this.indexOf(name);
    if (index < 0) return;
    return this.entries[index][1];
  }
  // Replace first header matching name (or append new header if not found)
  set(name, value) {
    let index = this.indexOf(name);
    if (index >= 0) this.entries[index][1] = value;
    else this.add(name, value);
  }
  // append new header, even if duplicate name already exists.
  add(name, value) {
    let index = this.entries.length;
    this.entries[index] = [name, value];
    this.indexes[name.toLowerCase()] = index;
  }
  // Convert back to raw format for use with http-codec
  get raw() {
    let raw = [];
    for (let entry of this.entries) {
      raw.push(entry[0], entry[1]);
    }
    return raw;
  }
}

export class Request {
  constructor (head, body) {
    head = head || {};
    this.method = head.method || 'GET';
    this.path = head.path || "/";
    this.version = head.version || 1.1;
    this.keepAlive = head.keepAlive || false;
    this.headers = new Headers(head.headers);
    this.body = body;
  }
  get raw() {
    return {
      method: this.method,
      path: this.path,
      version: this.version,
      keepAlive: this.keepAlive,
      headers: this.headers.raw
    };
  }
}
export class Response{
  constructor(head) {
    head = head || {};
    this.code = head.code || 404;
    this.version = head.version || 1.1;
    this.reason = head.reason;
    this.keepAlive = head.keepAlive || false;
    this.headers = new Headers(head.headers);
  }
  get raw() {
    return {
      code: this.code,
      reason: this.reason,
      version: this.version,
      keepAlive: this.keepAlive,
      headers: this.headers.raw
    };
  }
}


export class Server {
  constructor(options) {
    this.options = options;
    this.layers = [];
    this.bindings = [];
  }
  bind(options) {
    if (!options.host) options.host = "127.0.0.1";
    if (!options.port) options.port = 8080;
    this.bindings.push(options);
    return this;
  }
  use(layer) {
    this.layers.push(layer);
    return this;
  }
  route(options, layer) {
    let method = options.method;
    let path = options.path && compileRoute(options.path);
    let host = options.host && compileGlob(options.host);
    return this.use(function* (req, res, next) {
      if (method && (req.method !== method)) return yield* next();
      if (host && !host(req.headers.get("Host"))) return yield* next();
      let params;
      if (path) {
        params = path(req.pathname);
        if (!params) return yield* next();
      }
      req.params = params || {};
      return yield* layer(req, res, next);
    });
  }
  start() {
    if (!this.bindings.length) this.bind({});
    for (let binding of this.bindings) {
      let server = createNetServer(socket => {
        run(this.onConnection(socket)).catch(console.error);
      });
      server.listen(binding, function () {
        console.log("Server listening on:", server.address());
      });
    }
  }
  *onConnection(socket) {
    let read = makeRead(socket, decoder());
    let write = makeWrite(socket, encoder());
    let head;
    while ((head = yield read())) {
      let body = [];
      let chunk;
      while ((chunk = yield read())) {
        if (chunk.length === 0) break;
        body.push(chunk);
      }
      let req = new Request(head, body);
      let res = new Response();

      try {
        yield* this.runLayer(0, req, res);
      }
      catch (err) {
        res.code = 500;
        res.body = err.stack;
      }

      write(res.raw);

      if (res.upgrade) {
        read.updateDecode(decode);
        write.updateEncode(encode);
        yield* res.upgrade(req, read, write);
      }

      if (res.body) write(flatten(res.body));
      write("");
      if (!chunk) break;
    }
    socket.close();
  }
  *runLayer(index, req, res) {
    let layer = this.layers[index];
    if (!layer) return;
    let self = this;
    return yield* layer(req, res, function*() {
      return yield* self.runLayer(index + 1, req, res);
    });
  }

}

export function* logger(req, res, next) {
  let userAgent = req.headers.get("User-Agent");

  // Run all inner layers first.
  yield* next();

  // And then log after everything is done
  if (userAgent) {
    // Skip this layer for clients who don't send User-Agent headers.
    console.log(`${req.method} ${req.path} ${userAgent} ${res.code}`);
  }
}

export function* autoHeaders(req, res, next) {
  let isHead = false;
  if (req.method === 'HEAD') {
    req.method = 'GET';
    isHead = true;
  }

  let match = req.path.match(/^([^?]*)\??(.*)/);
  let pathname = match[1],
      query = match[2];
  req.pathname = pathname;
  if (query) {
    req.query = parseQuery(query);
  }

  if (req.body) {
    req.body = flatten(req.body);
  }

  let requested = req.headers.get('If-None-Match');

  yield* next();

  let headers = res.headers;
  if (!headers.has("Server")) {
    headers.add("Server", "Weblit-JS");
  }
  if (!headers.has("Date")) {
    headers.add("Date", new Date().toUTCString());
  }
  if (!headers.has("Connection")) {
    headers.add("Connection", req.keepAlive ? "Keep-Alive" : "Close");
  }
  res.keepAlive = headers.has("Connection") &&
    headers.get("Connection").toLowerCase() === "keep-alive";

  if (res.body) {
    let body = res.body = flatten(res.body);
    let needLength = !(headers.has("Content-Length") ||
                       headers.has("Transfer-Encoding"));
    if (needLength) {
      headers.set("Content-Length", "" + body.length);
    }
    if (!headers.has("ETag")) {
      headers.set("ETag", `"${sha1(body)}"`);
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "text/plain");
    }
  }

  let etag = headers.get("ETag");
  if (requested && res.code >=200 && res.code < 300 && requested === etag) {
    res.code = 304;
    res.body = null;
  }

  if (isHead) {
    res.body = null;
  }
}

export function files(root) {
  let m = module;
  while (m.parent) m = m.parent;
  if (root[0] !== '/') root = pathJoin(m.filename, "..", root);
  return function* (req, res, next) {
    if (req.method !== 'GET') return yield* next();
    let path = pathJoin(root, req.pathname);
    let data = yield new Promise(function (resolve, reject) {
      readFileNode(path, onRead);
      function onRead(err, data) {
        if (err) {
          if (err.code === "ENOENT") return resolve();
          if (err.code === "EISDIR") {
            path = pathJoin(path, "index.html");
            return readFileNode(path, onRead);
          }
          return reject(err);
        }
        return resolve(data);
      }
    });
    if (!data) return yield* next();
    res.code = 200;
    res.headers.set("Content-Type", guess(path));
    res.body = data;
  };
}

export function websocket(onSocket) {
  return function* (req, res, next) {

    // WebSocket connections must be GET requests
    if (req.method !== "GET") return yield* next();

    // Must have 'Upgrade: websocket' and 'Connection: Upgrade' headers
    let headers = req.headers;
    let connection = headers.get("Connection");
    let upgrade = headers.get("Upgrade");
    if (!(connection && /upgrade/i.test(connection) &&
          upgrade && /websocket/i.test(upgrade))) return yield* next();

    // Make sure it's a new client speaking v13 of the protocol
    if (parseInt(headers.get("Sec-WebSocket-Version"), 10) < 13) {
      throw new Error("only websocket protocol v13 supported");
    }

    // Make sure it has a websocket key
    let key = headers.get("Sec-WebSocket-Key");
    if (!key) {
      throw new Error("websocket security key missing");
    }

    let accept = acceptKey(key);

    res.code = 101;
    res.headers.set("Upgrade", "websocket");
    res.headers.set("Connection", "Upgrade");
    res.headers.set("Sec-WebSocket-Accept", accept);
    res.upgrade = onSocket;
  };
}

export function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    let options = urlParse(url);
    options.method = method;
    options.headers = headers;
    let req = nodeRequest(options, (res) => {
      res.on('error', reject);
      let parts = [];
      res.on('data', (chunk) => {
        parts.push(chunk);
      });
      res.on('end', () => {
        resolve(flatten(parts));
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

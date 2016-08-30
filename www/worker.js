(function () {
'use strict';

// Usage: run(iter) -> Promise
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

// A simple mime database.
let types;

let defaultMime = "application/octet-stream";

function guess(path) {
  path = path.toLowerCase().trim();
  var index = path.lastIndexOf("/");
  if (index >= 0) {
    path = path.substr(index + 1);
  }
  index = path.lastIndexOf(".");
  if (index >= 0) {
    path = path.substr(index + 1);
  }
  return types[path] || defaultMime;
}

// Borrowed and passed around from who knows where, last grabbed from connect.
types = {
  "3gp": "video/3gpp",
  a: "application/octet-stream",
  ai: "application/postscript",
  aif: "audio/x-aiff",
  aiff: "audio/x-aiff",
  asc: "application/pgp-signature",
  asf: "video/x-ms-asf",
  asm: "text/x-asm",
  asx: "video/x-ms-asf",
  atom: "application/atom+xml",
  au: "audio/basic",
  avi: "video/x-msvideo",
  bat: "application/x-msdownload",
  bin: "application/octet-stream",
  bmp: "image/bmp",
  bz2: "application/x-bzip2",
  c: "text/x-csrc",
  cab: "application/vnd.ms-cab-compressed",
  can: "application/candor",
  cc: "text/x-c++src",
  chm: "application/vnd.ms-htmlhelp",
  "class": "application/octet-stream",
  com: "application/x-msdownload",
  conf: "text/plain",
  cpp: "text/x-c",
  crt: "application/x-x509-ca-cert",
  css: "text/css",
  csv: "text/csv",
  cxx: "text/x-c",
  deb: "application/x-debian-package",
  der: "application/x-x509-ca-cert",
  diff: "text/x-diff",
  djv: "image/vnd.djvu",
  djvu: "image/vnd.djvu",
  dll: "application/x-msdownload",
  dmg: "application/octet-stream",
  doc: "application/msword",
  dot: "application/msword",
  dtd: "application/xml-dtd",
  dvi: "application/x-dvi",
  ear: "application/java-archive",
  eml: "message/rfc822",
  eps: "application/postscript",
  exe: "application/x-msdownload",
  f: "text/x-fortran",
  f77: "text/x-fortran",
  f90: "text/x-fortran",
  flv: "video/x-flv",
  "for": "text/x-fortran",
  gem: "application/octet-stream",
  gemspec: "text/x-script.ruby",
  gif: "image/gif",
  gyp: "text/x-script.python",
  gypi: "text/x-script.python",
  gz: "application/x-gzip",
  h: "text/x-chdr",
  hh: "text/x-c++hdr",
  htm: "text/html",
  html: "text/html",
  ico: "image/vnd.microsoft.icon",
  ics: "text/calendar",
  ifb: "text/calendar",
  iso: "application/octet-stream",
  jar: "application/java-archive",
  java: "text/x-java-source",
  jnlp: "application/x-java-jnlp-file",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "application/javascript",
  json: "application/json",
  less: "text/css",
  log: "text/plain",
  lua: "text/x-script.lua",
  luac: "application/x-bytecode.lua",
  makefile: "text/x-makefile",
  m3u: "audio/x-mpegurl",
  m4v: "video/mp4",
  man: "text/troff",
  manifest: "text/cache-manifest",
  markdown: "text/x-markdown",
  mathml: "application/mathml+xml",
  mbox: "application/mbox",
  mdoc: "text/troff",
  md: "text/x-markdown",
  me: "text/troff",
  mid: "audio/midi",
  midi: "audio/midi",
  mime: "message/rfc822",
  mml: "application/mathml+xml",
  mng: "video/x-mng",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mp4v: "video/mp4",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  ms: "text/troff",
  msi: "application/x-msdownload",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
  ogg: "application/ogg",
  p: "text/x-pascal",
  pas: "text/x-pascal",
  pbm: "image/x-portable-bitmap",
  pdf: "application/pdf",
  pem: "application/x-x509-ca-cert",
  pgm: "image/x-portable-graymap",
  pgp: "application/pgp-encrypted",
  pkg: "application/octet-stream",
  pl: "text/x-script.perl",
  pm: "text/x-script.perl-module",
  png: "image/png",
  pnm: "image/x-portable-anymap",
  ppm: "image/x-portable-pixmap",
  pps: "application/vnd.ms-powerpoint",
  ppt: "application/vnd.ms-powerpoint",
  ps: "application/postscript",
  psd: "image/vnd.adobe.photoshop",
  py: "text/x-script.python",
  qt: "video/quicktime",
  ra: "audio/x-pn-realaudio",
  rake: "text/x-script.ruby",
  ram: "audio/x-pn-realaudio",
  rar: "application/x-rar-compressed",
  rb: "text/x-script.ruby",
  rdf: "application/rdf+xml",
  roff: "text/troff",
  rpm: "application/x-redhat-package-manager",
  rss: "application/rss+xml",
  rtf: "application/rtf",
  ru: "text/x-script.ruby",
  s: "text/x-asm",
  sgm: "text/sgml",
  sgml: "text/sgml",
  sh: "application/x-sh",
  sig: "application/pgp-signature",
  snd: "audio/basic",
  so: "application/octet-stream",
  svg: "image/svg+xml",
  svgz: "image/svg+xml",
  swf: "application/x-shockwave-flash",
  t: "text/troff",
  tar: "application/x-tar",
  tbz: "application/x-bzip-compressed-tar",
  tci: "application/x-topcloud",
  tcl: "application/x-tcl",
  tex: "application/x-tex",
  texi: "application/x-texinfo",
  texinfo: "application/x-texinfo",
  text: "text/plain",
  tif: "image/tiff",
  tiff: "image/tiff",
  torrent: "application/x-bittorrent",
  tr: "text/troff",
  ts: "application/x-typescript",
  ttf: "application/x-font-ttf",
  txt: "text/plain",
  vcf: "text/x-vcard",
  vcs: "text/x-vcalendar",
  vrml: "model/vrml",
  war: "application/java-archive",
  wav: "audio/x-wav",
  webapp: "application/x-web-app-manifest+json",
  webm: "video/webm",
  wma: "audio/x-ms-wma",
  wmv: "video/x-ms-wmv",
  wmx: "video/x-ms-wmx",
  wrl: "model/vrml",
  wsdl: "application/wsdl+xml",
  xbm: "image/x-xbitmap",
  xhtml: "application/xhtml+xml",
  xls: "application/vnd.ms-excel",
  xml: "application/xml",
  xpm: "image/x-xpixmap",
  xsl: "application/xml",
  xslt: "application/xslt+xml",
  yaml: "text/yaml",
  yml: "text/yaml",
  zip: "application/zip"
};

function pathJoin(base, ...parts) {
  parts = (base + "/" + parts.join("/")).split(/\/+/);
  let i = 0;
  while (i < parts.length) {
    let part = parts[i];
    if (!part || part === '.') parts.splice(i, 1);
    else if (part !== '..') i++;
    else {
      parts.splice(i - 1, 2);
      i--;
      if (i < 0) i = 0;
    }
  }
  return (base[0] === '/' ? '/' : '') + parts.join("/");
}

// TYPES:
//   bin - a Uint8Array containing binary data.
//   str - a normal unicode string.
//   raw - a string where each character's charCode is a byte value. (utf-8)
//   hex - a string holding binary data as lowercase hexadecimal.
//   b64 - a string holding binary data in base64 encoding.

// Make working with Uint8Array less painful in node.js
Uint8Array.prototype.inspect = function () {
  let str = '';
  for (let i = 0; i < this.length; i++) {
    if (i >= 50) { str += '...'; break; }
    str += (this[i] < 0x10 ? ' 0' : ' ') + this[i].toString(16);
  }
  return '<Uint8Array' + str + '>';
}

function binToRaw(bin, start, end) {
  if (!(bin instanceof Uint8Array)) bin = new Uint8Array(bin);
  start = start == null ? 0 : start | 0;
  end = end == null ? bin.length : end | 0;
  let raw = '';
  for (let i = start || 0; i < end; i++) {
    raw += String.fromCharCode(bin[i]);
  }
  return raw;
}

function rawToStr(raw) {
  return decodeURIComponent(escape(raw));
}

const codes =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
// Reverse map from character code to 6-bit integer
let map = [];
for (let i = 0, l = codes.length; i < l; i++) {
  map[codes.charCodeAt(i)] = i;
}

function binToStr(bin, start, end) {
  return rawToStr(binToRaw(bin, start, end));
}

let extensions = [];
let extdex = {};

function register(code, Constructor, encoder, decoder) {
  extensions.push(extdex[code] = {
    code: code,
    Constructor: Constructor,
    encoder: encoder,
    decoder: decoder
  });
}
function decode(buf) {
  let offset = 0,
      buffer = buf;
  return realDecode();

  function readMap(len) {
    let obj = {};
    while (len-- > 0) {
      obj[realDecode()] = realDecode();
    }
    return obj;
  }

  function readArray(len) {
    let arr = new Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = realDecode();
    }
    return arr;
  }

  function readString(len) {
    var str = binToStr(buffer, offset, offset + len);
    offset += len;
    return str;
  }

  function readBin(len) {
    let buf = buffer.slice(offset, offset + len);
    offset += len;
    return buf;
  }

  function readExt(len, type) {
    let buf = buffer.slice(offset, offset + len);
    offset += len;
    let ext = extdex[type];
    return ext.decoder(buf);
  }

  function read8() {
    return (buffer[offset++]) >>> 0;
  }

  function read16() {
    return (
      buffer[offset++] << 8 |
      buffer[offset++]
    ) >>> 0;
  }

  function read32() {
    return (
      buffer[offset++] << 24 |
      buffer[offset++] << 16 |
      buffer[offset++] << 8 |
      buffer[offset++]
    ) >>> 0;
  }

  function read64() {
    return read32() * 0x100000000 +
           read32();
  }

  function readFloat() {
    let num = new DataView(buffer).getFloat32(offset, false);
    offset += 4;
    return num;
  }

  function readDouble() {
    let num = new DataView(buffer).getFloat64(offset, false);
    offset += 8;
    return num;
  }

  function realDecode() {
    if (offset >= buffer.length) {
      throw new Error("Unexpected end of msgpack buffer");
    }
    let first = buffer[offset++];
    // positive fixint
    if (first < 0x80) return first;
    // fixmap
    if (first < 0x90) return readMap(first & 0xf);
    // fixarray
    if (first < 0xa0) return readArray(first & 0xf);
    // fixstr
    if (first < 0xc0) return readString(first & 0x1f);
    // negative fixint
    if (first >= 0xe0) return first - 0x100;
    switch (first) {
      // nil
      case 0xc0: return null;
      // false
      case 0xc2: return false;
      // true
      case 0xc3: return true;
      // bin 8
      case 0xc4: return readBin(read8());
      // bin 16
      case 0xc5: return readBin(read16());
      // bin 32
      case 0xc6: return readBin(read32());
      // ext 8
      case 0xc7: return readExt(read8(), read8());
      // ext 16
      case 0xc8: return readExt(read16(), read8());
      // ext 32
      case 0xc9: return readExt(read32(), read8());
      // float 32
      case 0xca: return readFloat();
      // float 64
      case 0xcb: return readDouble();
      // uint 8
      case 0xcc: return read8();
      // uint 16
      case 0xcd: return read16();
      // uint 32
      case 0xce: return read32();
      // uint 64
      case 0xcf: return read64();
      // int 8
      case 0xd0: return read8() - 0x100;
      // int 16
      case 0xd1: return read16() - 0x10000;
      // int 32
      case 0xd2: return read32() - 0x100000000;
      // int 64
      case 0xd3: return read64() - 0x10000000000000000;
      // fixext 1
      case 0xd4: return readExt(1, read8());
      // fixext 2
      case 0xd5: return readExt(2, read8());
      // fixext 4
      case 0xd6: return readExt(4, read8());
      // fixext 8
      case 0xd7: return readExt(8, read8());
      // fixext 16
      case 0xd8: return readExt(16, read8());
      // str 8
      case 0xd9: return readString(read8());
      // str 16
      case 0xda: return readString(read16());
      // str 32
      case 0xdb: return readString(read32());
      // array 16
      case 0xdc: return readArray(read16());
      // array 32
      case 0xdd: return readArray(read32());
      // map 16
      case 0xde: return readMap(read16());
      // map 32
      case 0xdf: return readMap(read32());

      default: throw new Error("Unexpected byte: " + first.toString(16));
    }
  }
}

// Consumers of this API must provide the following interface here.
// function get(hash) -> promise<value>
// function set(hash, value) -> promise
let storage = {};

// Register the Link type so we can serialize hashes as a new special type.
// hash itself is just a 20 byte Uint8Array
register(127, Link,
  (link) => { return link.hash; },
  (buf) => { return new Link(buf); }
);

// Load accepts a link or a string hash as input.
function* load(link) {
  let hex = typeof link === "string" ?
    link : link.toHex();
  return decode(yield storage.get(hex));
}

// Link has some nice methods in addition to storing the hash buffer.
function Link(hash) {
  if (hash.constructor === ArrayBuffer) {
    hash = new Uint8Array(hash);
  }
  if (hash.constructor === Uint8Array) {
    this.hash = hash;
    return;
  }
  if (typeof hash === "string") {
    if (!/^[0-9a-f]{40}$/.test(hash)) {
      throw new TypeError("Invalid string, expected hash");
    }
    this.hash = new Uint8Array(20);
    let j = 0;
    for (let i = 0; i < 40; i += 2) {
      this.hash[j++] = parseInt(hash.substr(i, 2), 16);
    }
    return;
  }
  throw new TypeError("Invalid hash, expected string or buffer");
}
Link.prototype.resolve = function* resolve() {
  return yield* load(this);
};
Link.prototype.toHex = function toHex() {
  let hex = "";
  let buf = this.hash;
  for (let i = 0, l = buf.length; i < l; i++) {
    let byte = buf[i];
    hex += (byte < 0x10 ? "0" : "") + byte.toString(16);
  }
  if (!hex) throw new Error("WAT")
  return hex;
};

let db;

function getDB() {
  if (!db) {
    db = new Promise(function(resolve, reject) {
      let openreq = indexedDB.open('keyval-store', 1);

      openreq.onerror = function() {
        reject(openreq.error);
      };

      openreq.onupgradeneeded = function() {
        // First time setup: create an empty object store
        openreq.result.createObjectStore('keyval');
      };

      openreq.onsuccess = function() {
        resolve(openreq.result);
      };
    });
  }
  return db;
}

function withStore(type, callback) {
  return getDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      let transaction = db.transaction('keyval', type);
      transaction.oncomplete = function() {
        resolve();
      };
      transaction.onerror = function() {
        reject(transaction.error);
      };
      callback(transaction.objectStore('keyval'));
    });
  });
}

let idbKeyval = {
  get: function(key) {
    let req;
    return withStore('readonly', function(store) {
      req = store.get(key);
    }).then(function() {
      return req.result;
    });
  },
  set: function(key, value) {
    return withStore('readwrite', function(store) {
      store.put(value, key);
    });
  },
  delete: function(key) {
    return withStore('readwrite', function(store) {
      store.delete(key);
    });
  },
  clear: function() {
    return withStore('readwrite', function(store) {
      store.clear();
    });
  },
  keys: function() {
    let keys = [];
    return withStore('readonly', function(store) {
      // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
      // And openKeyCursor isn't supported by Safari.
      (store.openKeyCursor || store.openCursor).call(store).onsuccess = function() {
        if (!this.result) return;
        keys.push(this.result.key);
        this.result.continue();
      };
    }).then(function() {
      return keys;
    });
  }
};

// Hook up link's storage to use idbKeyval
storage.get = idbKeyval.get;
storage.set = idbKeyval.set;
storage.clear = idbKeyval.clear;

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

}());
//# sourceMappingURL=worker.js.map

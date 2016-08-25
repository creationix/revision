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

function runAll(iters) {
  return Promise.all(iters.map(run));
}

function flatten(parts) {
  if (typeof parts === "number") return new Uint8Array([parts]);
  if (parts instanceof Uint8Array) return parts;
  if (!Array.isArray(parts)) {
    throw new TypeError("Bad type for flatten: " + typeof parts);
  }
  let buffer = new Uint8Array(count(parts));
  copy(buffer, 0, parts);
  return buffer;
}

function count(value) {
  if (typeof value === "number") return 1;
  let sum = 0;
  for (let piece of value) {
    sum += count(piece);
  }
  return sum;
}

function copy(buffer, offset, value) {
  if (typeof value === "number") {
    buffer[offset++] = value;
    return offset;
  }
  if (value instanceof ArrayBuffer) {
    value = new Uint8Array(value);
  }
  for (let piece of value) {
    offset = copy(buffer, offset, piece);
  }
  return offset;
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
function uint8(num) {
  return (num>>>0) & 0xff;
}

function uint16(num) {
  num = (num>>>0) & 0xffff;
  return [
    num >> 8,
    num & 0xff
  ];
}
function uint32(num) {
  num >>>= 0;
  return [
    num >> 24,
    (num >> 16) & 0xff,
    (num >> 8) & 0xff,
    num & 0xff
  ];
}
function uint64(value) {
  if (value < 0) value += 0x10000000000000000;
  return [
    uint32(value / 0x100000000),
    uint32(value % 0x100000000)
  ];
}


function encode(value) {
  return flatten(realEncode(value));
}

function pairMap(key) {
  return [
    realEncode(key),
    realEncode(this[key])
  ];
}

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}
function decode_utf8(s) {
  return decodeURIComponent(escape(s));
}
function stringToBuffer(str) {
  return rawToBuffer(encode_utf8(str));
}
function rawToBuffer(raw) {
  let len = raw.length;
  let buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buf[i] = raw.charCodeAt(i);
  }
  return buf;
}

function tooLong(len, value) {
  throw new TypeError("Value is too long: " + (typeof value) + "/" + len);
}

function realEncode(value) {
  // nil format family
  if (value == null) return 0xc0;

  // bool format family
  if (value === false) return 0xc2;
  if (value === true) return 0xc3

  if (typeof value === "number") {
    // int format family
    if (Math.floor(value) === value) {
      // Positive integers
      if (value >= 0) {
        if (value < 0x80) return value;
        if (value < 0x100) return [0xcc, value];
        if (value < 0x10000) return [0xcd, uint16(value)];
        if (value < 0x100000000) return [0xce, uint32(value)];
        if (value < 0x10000000000000000) return [0xcf, uint64(value)];
        tooLong(value, value);
      }
      // Negative integers
      if (value > -0x20) return value + 0x100;
      if (value >= -0x80) return [0xd0, uint8(value)];
      if (value >= -0x8000) return [0xd1, uint16(value)];
      if (value >= -0x80000000) return [0xd2, uint32(value)];
      if (value >= -0x8000000000000000) return [0xd3, uint64(value)];
      tooLong(value, value);
    }

    // float format family
    else {
      // All numbers in JS are double, so just assume that when encoding.
      let buf = new Uint8Array(8);
      new DataView(buf).setFloat64(0, value, false);
      return [0xcb, buf];
    }
  }

  // str format family
  if (value.constructor === String) {
    value = stringToBuffer(value);
    let len = value.length;
    if (len < 0x20) return [0xa0|len, value];
    if (len < 0x100) return [0xd9, len, value];
    if (len < 0x10000) return [0xda, uint16(len), value];
    if (len < 0x100000000) return [0xdb, uint32(len), value];
    tooLong(len, value);
  }

  // bin format family
  if (value.constructor === ArrayBuffer) value = new Uint8Array(value);
  if (value.constructor === Uint8Array) {
    let len = value.length;
    if (len < 0x100) return [0xc4, len, value];
    if (len < 0x10000) return [0xc5, uint16(len), value];
    if (len < 0x100000000) return [0xc6, uint32(len), value];
    tooLong(len, value);
  }

  // array format family
  if (Array.isArray(value)) {
    let len = value.length;
    if (len < 0x10) return [0x90|len, value.map(realEncode)];
    if (len < 0x10000) return [0xdc, uint16(len), value.map(realEncode)];
    if (len < 0x100000000) return [0xdd, uint32(len), value.map(realEncode)];
    tooLong(len, value);
  }

  // map format family
  if (value.constructor === Object) {
    let keys = Object.keys(value);
    let len = keys.length;
    if (len < 0x10) return [0x80|len, keys.map(pairMap, value)];
    if (len < 0x10000) return [0xde, len, keys.map(pairMap, value)];
    if (len < 0x100000000) return [0xdf, len, keys.map(pairMap, value)];
    tooLong(len, value);
  }

  // ext format family
  for (let ext of extensions) {
    if (value.constructor === ext.Constructor) {
      let buf = ext.encoder(value);
      let len = buf.length;
      if (len === 1) return [0xd4, ext.code, buf];
      if (len === 2) return [0xd5, ext.code, buf];
      if (len === 4) return [0xd6, ext.code, buf];
      if (len === 8) return [0xd7, ext.code, buf];
      if (len === 16) return [0xd8, ext.code, buf];
      if (len < 0x100) return [0xc7, len, ext.code, buf];
      if (len < 0x10000) return [0xc8, uint16(len), ext.code, buf];
      if (len < 0x100000000) return [0xc8, uint32(len), ext.code, buf];
      tooLong(len, value);
    }
  }

  throw new TypeError(
    "Unknown type: " + Object.prototype.toString.call(value) +
    "\nPerhaps register it as a custom type?");
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
    var str = "";
    while (len--) {
      str += String.fromCharCode(buffer[offset++]);
    }
    return decode_utf8(str);
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

// Register the Link type so we can serialize hashes as a new special type.
// hash itself is just a 20 byte Uint8Array
register(127, Link,
  (link) => { return link.hash; },
  (buf) => { return new Link(buf); }
);

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
}
Link.prototype.toHex = function toHex() {
  let hex = "";
  let buf = this.hash;
  for (let i = 0, l = buf.length; i < l; i++) {
    let byte = buf[i];
    hex += (byte < 0x10 ? "0" : "") + byte.toString(16);
  }
  if (!hex) throw new Error("WAT")
  return hex;
}

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

let shared = new Uint32Array(80);

// Input chunks must be either arrays of bytes or "raw" encoded strings
function sha1(buffer) {
  if (buffer === undefined) return create(false);
  let shasum = create(true);
  shasum.update(buffer);
  return shasum.digest();
}

// A pure JS implementation of sha1 for non-node environments.
function create(sync) {
  let h0 = 0x67452301;
  let h1 = 0xEFCDAB89;
  let h2 = 0x98BADCFE;
  let h3 = 0x10325476;
  let h4 = 0xC3D2E1F0;
  // The first 64 bytes (16 words) is the data chunk
  let block, offset = 0, shift = 24;
  let totalLength = 0;
  if (sync) block = shared;
  else block = new Uint32Array(80);

  return { update: update, digest: digest };

  // The user gave us more data.  Store it!
  function update(chunk) {
    if (typeof chunk === "string") return updateString(chunk);
    let length = chunk.length;
    totalLength += length * 8;
    for (let i = 0; i < length; i++) {
      write(chunk[i]);
    }
  }

  function updateString(string) {
    let length = string.length;
    totalLength += length * 8;
    for (let i = 0; i < length; i++) {
      write(string.charCodeAt(i));
    }
  }


  function write(byte) {
    block[offset] |= (byte & 0xff) << shift;
    if (shift) {
      shift -= 8;
    }
    else {
      offset++;
      shift = 24;
    }
    if (offset === 16) processBlock();
  }

  // No more data will come, pad the block, process and return the result.
  function digest() {
    // Pad
    write(0x80);
    if (offset > 14 || (offset === 14 && shift < 24)) {
      processBlock();
    }
    offset = 14;
    shift = 24;

    // 64-bit length big-endian
    write(0x00); // numbers this big aren't accurate in javascript anyway
    write(0x00); // ..So just hard-code to zero.
    write(totalLength > 0xffffffffff ? totalLength / 0x10000000000 : 0x00);
    write(totalLength > 0xffffffff ? totalLength / 0x100000000 : 0x00);
    for (let s = 24; s >= 0; s -= 8) {
      write(totalLength >> s);
    }

    // At this point one last processBlock() should trigger and we can pull out the result.
    return toHex(h0) +
           toHex(h1) +
           toHex(h2) +
           toHex(h3) +
           toHex(h4);
  }

  // We have a full block to process.  Let's do it!
  function processBlock() {
    // Extend the sixteen 32-bit words into eighty 32-bit words:
    for (let i = 16; i < 80; i++) {
      let w = block[i - 3] ^ block[i - 8] ^ block[i - 14] ^ block[i - 16];
      block[i] = (w << 1) | (w >>> 31);
    }

    // log(block);

    // Initialize hash value for this chunk:
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f, k;

    // Main loop:
    for (let i = 0; i < 80; i++) {
      if (i < 20) {
        f = d ^ (b & (c ^ d));
        k = 0x5A827999;
      }
      else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      }
      else if (i < 60) {
        f = (b & c) | (d & (b | c));
        k = 0x8F1BBCDC;
      }
      else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }
      let temp = (a << 5 | a >>> 27) + f + e + k + (block[i]|0);
      e = d;
      d = c;
      c = (b << 30 | b >>> 2);
      b = a;
      a = temp;
    }

    // Add this chunk's hash to result so far:
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;

    // The block is now reusable.
    offset = 0;
    for (let i = 0; i < 16; i++) {
      block[i] = 0;
    }
  }

  function toHex(word) {
    let hex = "";
    for (let i = 28; i >= 0; i -= 4) {
      hex += ((word >> i) & 0xf).toString(16);
    }
    return hex;
  }

}

function digest(buf) {
  return new Link(sha1(buf));
}

function* save(value) {
  let buf = encode(value);
  let link = digest(buf);
  yield idbKeyval.set(link.toHex(), buf);
  return link;
}

function* load(link) {
  let hex = typeof link === "string" ?
    link : link.toHex();
  return decode(yield idbKeyval.get(hex));
}

function* get(path, format) {
  format = format || "json";
  let url = `https://api.github.com/${path}`;
  let headers = {
    Accept: format === 'arrayBuffer' || format === 'text' ?
      "application/vnd.github.v3.raw" :
      "application/vnd.github.v3+json"
  };
  let username = (yield idbKeyval.get("GITHUB_USERNAME")) ||
    prompt("Enter github username (for API auth)");
  if (username) yield idbKeyval.set("GITHUB_USERNAME", username);
  let token = (yield idbKeyval.get("GITHUB_TOKEN")) ||
    prompt("Enter personal access token (for API auth)");
  if (token) yield idbKeyval.set("GITHUB_TOKEN", token);
  headers.Authorization = `Basic ${btoa(`${username}:${token}`)}`;
  let res = yield fetch(url, {headers:headers});
  return res && (yield res[format]());
}

function* importCommit(owner, repo, rootSha, onStart, onFinish) {

  let modeToRead = {
     '40000': readTree, // tree
    '040000': readTree, // tree
    '100644': readBlob, // blob
    '100755': readExec, // exec
    '120000': readSym, // sym
    '160000': readSubmodule  // commit
  }

  return yield* readCommit(rootSha);

  function* deref(ref) {
    if (/^[0-9a-f]{40}$/.test(ref)) return ref;
    let result = yield* get(`repos/${owner}/${repo}/git/refs/${ref}`);
    return result && result.object.sha;
  }

  function* gitLoad(type, sha) {
    onStart(sha);
    let result;// = yield storage.get(sha);
    if (!result) {
      result = yield* get(
        `repos/${owner}/${repo}/git/${type}s/${sha}`,
        type === "blob" ? "arrayBuffer" : "json"
      );
      if (result) {
        if (type === "blob") result = new Uint8Array(result);
        // yield storage.set(sha, result);
      }
    }
    onFinish(sha);
    return result;
  }

  function bufToString(buf) {
    let str = "";
    for (let i = 0, l = buf.length; i <l; i++) {
      str += String.fromCharCode(buf[i]);
    }
    return str;
  }

  function parseGitmodules(buf) {
    let text = bufToString(buf);
    let config = {};
    let section;
    text.split(/[\r\n]+/).forEach(function (line) {
      let match = line.match(/\[([^ \t"\]]+) *(?:"([^"]+)")?\]/);
      if (match) {
        section = config[match[1]] || (config[match[1]] = {});
        if (match[2]) {
          section = section[match[2]] = {};
        }
        return;
      }
      match = line.match(/([^ \t=]+)[ \t]*=[ \t]*(.+)/);
      if (match) {
        section[match[1]] = match[2];
      }
    });
    return config;
  }

  function* readSym(sha) {
    let buf = yield* gitLoad("blob", sha);
    return bufToString(buf);
  }

  function* readExec(sha) {
    let buf = yield* gitLoad("blob", sha);
    // We're throwing away the exec bit
    return yield* save(buf);
  }

  function* readBlob(sha) {
    let buf = yield* gitLoad("blob", sha);
    return yield* save(buf);
  }

  function* readTree(sha, path, gitmodules) {
    let result = yield* gitLoad("tree", sha);
    let tasks = [];
    for (let entry of result.tree) {
      if (!gitmodules && entry.path === ".gitmodules") {
        gitmodules = parseGitmodules(
          yield* gitLoad("blob", entry.sha)
        );
      }
      let newPath = path ? `${path}/${entry.path}` : entry.path;
      tasks.push(modeToRead[entry.mode](
        entry.sha, newPath, gitmodules
      ));
    }
    let tree = {};
    (yield runAll(tasks)).forEach(function (item, i) {
      let entry = result.tree[i];
      tree[entry.path] = item;
    });
    return tree;
  }

  function* readCommit(sha) {
    sha = yield* deref(sha);
    let commit = yield* gitLoad("commit", sha);
    // We're throwing away the commit information and returning the tree directly.
    return yield* readTree(commit.tree.sha);
  }

  function* readSubmodule(sha, path, gitmodules) {
    let remote;
    for (let key in gitmodules.submodule) {
      let sub = gitmodules.submodule[key];
      if (sub.path !== path) continue;
      remote = sub.url;
      break;
    }
    if (!remote) throw new Error(`No gitmodules entry for ${path}`);
    let match = remote.match(/github.com[:\/]([^\/]+)\/(.+?)(\.git)?$/);
    if (!match) throw new Error(`Submodule is not on github ${remote}`);
    // Throw away the submodule information and return the tree.
    return yield* importCommit(match[1], match[2], sha, onStart, onFinish);
  }
}

//////////////////////////////////////
//                                  //
// JS domBuilder Library            //
//                                  //
// Tim Caswell <tim@creationix.com> //
//                                  //
//////////////////////////////////////

function domBuilder(json, refs) {

  // Render strings as text nodes
  if (typeof json === 'string') return document.createTextNode(json);

  // Pass through html elements and text nodes as-is
  if (json instanceof HTMLElement || json instanceof window.Text) return json;

  // Stringify any other value types
  if (!Array.isArray(json)) return document.createTextNode(json + "");

  // Empty arrays are just empty fragments.
  if (!json.length) return document.createDocumentFragment();

  var node, first;
  for (var i = 0, l = json.length; i < l; i++) {
    var part = json[i];

    if (!node) {
      if (typeof part === 'string') {
        // Create a new dom node by parsing the tagline
        var tag = part.match(TAG_MATCH);
        tag = tag ? tag[0] : "div";
        node = document.createElement(tag);
        first = true;
        var classes = part.match(CLASS_MATCH);
        if (classes) node.setAttribute('class', classes.map(stripFirst).join(' '));
        var id = part.match(ID_MATCH);
        if (id) node.setAttribute('id', id[0].substr(1));
        var ref = part.match(REF_MATCH);
        if (refs && ref) refs[ref[0].substr(1)] = node;
        continue;
      } else if (typeof part === "function") {
        return domBuilder(part.apply(null, json.slice(i + 1)), refs);
      } else {
        node = document.createDocumentFragment();
      }
    }

    // Except the first item if it's an attribute object
    if (first && typeof part === 'object' && part.constructor === Object) {
      setAttrs(node, part);
    } else {
      node.appendChild(domBuilder(part, refs));
    }
    first = false;
  }
  return node;
}

function setAttrs(node, attrs) {
  var keys = Object.keys(attrs);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    var value = attrs[key];
    if (key === "$") {
      value(node);
    } else if (key === "css" || key === "style" && value.constructor === Object) {
      setStyle(node.style, value);
    } else if (key.substr(0, 2) === "on") {
      node.addEventListener(key.substr(2), value, false);
    } else if (typeof value === "boolean") {
      if (value) node.setAttribute(key, key);
    } else {
      node.setAttribute(key, value);
    }
  }
}

function setStyle(style, attrs) {
  var keys = Object.keys(attrs);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    style[key] = attrs[key];
  }
}

var CLASS_MATCH = /\.[^.#$]+/g;
var ID_MATCH = /#[^.#$]+/;
var REF_MATCH = /\$[^.#$]+/;
var TAG_MATCH = /^[^.#$]+/;
function stripFirst(part) {
  return part.substr(1);
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

window.storage = idbKeyval;
let $ = {};
function render(root) {
  let tree = [
    renderTreeView(root),
    ["tree-resizer"],
    ["editor-view",
      ["iframe$iframe", {frameBorder:0,style:{display:"none"}}]
    ]
  ]
  document.body.textContent = "";
  document.body.appendChild(domBuilder(tree, $));
}

function renderTreeView(root) {
  return ["tree-view", {onclick:onClick},
    ["ul",
      renderTree("", "", root)
    ]
  ];
  function onClick(evt) {
    let node = evt.target;
    while (!node.dataset.path) {
      node = node.parentElement
      if (node === document.body) return;
    }
    let data = node.dataset;
    let url = `/${$.root}/${data.path}`;
    $.iframe.setAttribute("src", url);
    $.iframe.style.display = "inherit";
  }
}

function renderTree(path, name, node) {
  let entries = [];
  for (let key in node) {
    let subPath = (path ? path + "/" : "") + key;
    let sub = node[key];
    entries.push(
      (sub.constructor === Object ? renderTree :
       typeof sub === "string" ? renderLink :
       renderFile)(subPath, key, sub)
    );
  }
  let displayName = name || $.name;
  let icon = "icon-down-dir";
  return ["li",
    { class: icon,
      title: name,
      'data-type': 'tree',
      'data-name': name,
      'data-path': path },
    ["span.icon-folder", displayName],
    ["ul"].concat(entries)
  ];
}
function renderLink(path, name, target) {
  let icon = "icon-link";
  return ["li",
    { title: target,
      'data-type': 'link',
      'data-target': target,
      'data-name': name,
      'data-path': path },
    ["span", { class: icon }, name]
  ];
}
function renderFile(path, name) {
  let mime = guess(path);
  let icon = guessIcon(mime);
  return ["li",
    { title: name,
      'data-type': 'file',
      'data-mime': mime,
      'data-name': name,
      'data-path': path },
    ["span", { class: icon }, name]
  ];
}

function guessIcon(mime) {
  if (/pdf$/.test(mime)) return "icon-file-pdf";
  if (/^image/.test(mime)) return "icon-file-image";
  if (/^audio/.test(mime)) return "icon-file-audio";
  if (/^video/.test(mime)) return "icon-file-video";
  if (/^zip2?$/.test(mime)) return "icon-file-archive";
  if (/^application.*(javascript|json|xml)$/.test(mime) ||
      /^text.*(src|html|css|lua|script)$/.test(mime)) return "icon-file-code";
  if (/^text/.test(mime)) return "icon-doc-text";
  return "icon-doc";
}

// Register a service worker to serve it out as static content.
navigator.serviceWorker.register("worker.js");

let done = 0;
let total = 0;
function onStart() {
  total++;
  onUpdate();
}
function onFinish() {
  done++;
  onUpdate();
}
let dirty = false;
function onUpdate() {
  if (dirty) return;
  dirty = true;
  requestAnimationFrame(update);
}
function update() {
  document.body.innerHTML = `<div style="text-align:center"><h1>Importing from github (${done}/${total})</h1><progress class="import" max="${total}" value="${done}"></progress></div>`;
  dirty = false;
}

run(function*() {

  let match = window.location.hash.match(/github:\/\/([^\/]+)\/([^\/]+)\/refs\/(.+)$/);
  let owner, repo, ref;
  if (match) {
    owner = match[1];
    repo = match[2];
    ref = match[3];
  }
  else {
    owner = "creationix";
    repo = "revision";
    ref = "heads/master";
  }
  $.name = `${owner}/${repo}`;
  let key = `github://${owner}/${repo}/refs/${ref}`;
  window.location.hash = key;
  // Import repository from github into local CAS graph
  let root;// = yield storage.get(key);
  if (!root) {
    console.log(`Importing github://${owner}/${repo}/refs/${ref}`);
    let commit = yield* importCommit(owner, repo, ref, onStart, onFinish);
    let link = yield* save(commit);
    root = link.toHex();
    yield idbKeyval.set(key, link.toHex());
  }
  $.root = root;

  render(yield* load(root));

}());

}());
//# sourceMappingURL=main.js.map

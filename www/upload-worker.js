(function () {
'use strict';

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

function binToHex(bin, start, end) {
  if (!(bin instanceof Uint8Array)) bin = new Uint8Array(bin);
  start = start == null ? 0 : start | 0;
  end = end == null ? bin.length : end | 0;
  let hex = '';
  for (let i = start; i < end; i++) {
    let byte = bin[i];
    hex += (byte < 0x10 ? '0' : '') + byte.toString(16);
  }
  return hex;
}

function hexToBin(hex, start, end) {
  hex = '' + hex;
  start = start == null ? 0 : start | 0;
  end = end == null ? hex.length : end | 0;
  let len = (end - start) >> 1;
  let bin = new Uint8Array(len);
  let offset = 0;
  for (let i = start; i < end; i += 2) {
    bin[offset++] = parseInt(hex.substr(i, 2), 16);
  }
  return bin;
}

function rawToStr(raw) {
  return decodeURIComponent(escape(raw));
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

let storage = {};

// Save takes a value and serializes and stores it returning the link.
function* load(link) {
  let hex = typeof link === "string" ?
    link : link.toHex();
  return decode(yield storage.get(hex));
}

class Link {
  constructor(hash) {
    if (hash.constructor === ArrayBuffer) hash = new Uint8Array(hash);
    if (hash.constructor === Uint8Array) {
      this.hash = hash;
      return;
    }
    if (typeof hash === "string") {
      if (!/^[0-9a-f]{40}$/.test(hash)) {
        throw new TypeError("Invalid string, expected hash");
      }
      this.hash = hexToBin(hash);
      return;
    }
    throw new TypeError("Invalid hash, expected string or buffer");
  }
  *resolve() {
    return yield* load(this);
  }
  toHex() {
    return binToHex(this.hash);
  }
  toBin() {
    return this.hash;
  }
}

// Look for links in an object
register(127, Link,
  (link) => { return link.hash; },
  (buf) => { return new Link(buf); }
);

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

storage.get = idbKeyval.get;
storage.set = idbKeyval.set;
storage.has = idbKeyval.has;
storage.clear = idbKeyval.clear;

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

self.onmessage = function(evt) {
  wsConnect(evt.data.url).then(socket => {
    return upload(socket, evt.data.hash);
  })
    .then(self.postMessage)
    .catch(self.postMessage);
};

function wsConnect(url) {
  return new Promise((resolve, reject) => {
    let socket = new WebSocket(url);
    socket.onopen = () => resolve(socket);
    socket.onerror = reject;
  });
}

function upload(socket, rootHash) {
  return new Promise((resolve, reject) => {
    let done = {};
    let queue = [];
    socket.send("s:" + rootHash);

    socket.onmessage = evt => {
      let match = evt.data.match(/^(.):([0-9a-f]{40})$/);
      if (match) {
        let command = match[1],
            hash = match[2];
        if (command === 'w') {
          self.postMessage(1);
          queue.push(hash);
          run(process());
          return;
        }
        if (command === 'd' && hash === rootHash) {
          resolve();
          return;
        }
      }
      console.error("Unexpected message from server: " + evt.data);
    };
    socket.onerror = () => {
      reject(new Error("Problem in websocket connection with server"));
    }

    let working;

    function* process() {
      if (working) return;
      working = true;
      while (queue.length) {
        let hash = queue.pop();
        self.postMessage(-1);
        if (done[hash]) continue;
        let bin = yield storage.get(hash);
        socket.send(bin);
        done[hash] = true;
      }
      working = false;
    }

  });
}

}());
//# sourceMappingURL=upload-worker.js.map

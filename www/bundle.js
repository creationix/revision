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

register(127, Link,
  (link) => { return link.hash; },
  (buf) => { return new Link(buf); }
);

// Link has some nice methods in addition to storing the hash buffer.
function Link(hash) {
  this.hash = new Uint8Array(hash);
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


// Look for links in an object

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

let storage = {
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

/**
* [js-sha3]{@link https://github.com/emn178/js-sha3}
*
* @version 0.5.2
* @author Chen, Yi-Cyuan [emn178@gmail.com]
* @copyright Chen, Yi-Cyuan 2015-2016
* @license MIT
*/

var HEX_CHARS = '0123456789abcdef'.split('');
var PADDING = [6, 1536, 393216, 100663296];
var SHIFT = [0, 8, 16, 24];
var RC = [1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649,
          0, 2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0,
          2147483658, 0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771,
          2147483648, 32770, 2147483648, 128, 2147483648, 32778, 0, 2147483658, 2147483648,
          2147516545, 2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648];
var OUTPUT_TYPES = ['hex', 'buffer', 'array'];

var createOutputMethod = function (bits, padding, outputType) {
  return function (message) {
    return new Keccak(bits, padding, bits).update(message)[outputType]();
  };
};

var createMethod = function (bits, padding) {
  var method = createOutputMethod(bits, padding, 'hex');
  method.create = function () {
    return new Keccak(bits, padding, bits);
  };
  method.update = function (message) {
    return method.create().update(message);
  };
  for (var i = 0;i < OUTPUT_TYPES.length;++i) {
    var type = OUTPUT_TYPES[i];
    method[type] = createOutputMethod(bits, padding, type);
  }
  return method;
};

let sha3_256 = createMethod(256, PADDING);
// var methods = {};
//
// for (var i = 0;i < algorithms.length;++i) {
//   var algorithm = algorithms[i];
//   var bits  = algorithm.bits;
//   var createMethod = algorithm.createMethod;
//   for (var j = 0;j < bits.length;++j) {
//     var method = algorithm.createMethod(bits[j], algorithm.padding);
//     methods[algorithm.name +'_' + bits[j]] = method;
//   }
// }

function Keccak(bits, padding, outputBits) {
  this.blocks = [];
  this.s = [];
  this.padding = padding;
  this.outputBits = outputBits;
  this.reset = true;
  this.block = 0;
  this.start = 0;
  this.blockCount = (1600 - (bits << 1)) >> 5;
  this.byteCount = this.blockCount << 2;
  this.outputBlocks = outputBits >> 5;
  this.extraBytes = (outputBits & 31) >> 3;

  for (var i = 0;i < 50;++i) {
    this.s[i] = 0;
  }
}

Keccak.prototype.update = function (message) {
  var notString = typeof(message) !== 'string';
  if (notString && message.constructor === window.ArrayBuffer) {
    message = new Uint8Array(message);
  }
  var length = message.length, blocks = this.blocks, byteCount = this.byteCount,
      blockCount = this.blockCount, index = 0, s = this.s, i, code;

  while (index < length) {
    if (this.reset) {
      this.reset = false;
      blocks[0] = this.block;
      for (i = 1;i < blockCount + 1;++i) {
        blocks[i] = 0;
      }
    }
    if (notString) {
      for (i = this.start;index < length && i < byteCount; ++index) {
        blocks[i >> 2] |= message[index] << SHIFT[i++ & 3];
      }
    } else {
      for (i = this.start;index < length && i < byteCount; ++index) {
        code = message.charCodeAt(index);
        if (code < 0x80) {
          blocks[i >> 2] |= code << SHIFT[i++ & 3];
        } else if (code < 0x800) {
          blocks[i >> 2] |= (0xc0 | (code >> 6)) << SHIFT[i++ & 3];
          blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
        } else if (code < 0xd800 || code >= 0xe000) {
          blocks[i >> 2] |= (0xe0 | (code >> 12)) << SHIFT[i++ & 3];
          blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
          blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
        } else {
          code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
          blocks[i >> 2] |= (0xf0 | (code >> 18)) << SHIFT[i++ & 3];
          blocks[i >> 2] |= (0x80 | ((code >> 12) & 0x3f)) << SHIFT[i++ & 3];
          blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
          blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
        }
      }
    }
    this.lastByteIndex = i;
    if (i >= byteCount) {
      this.start = i - byteCount;
      this.block = blocks[blockCount];
      for (i = 0;i < blockCount;++i) {
        s[i] ^= blocks[i];
      }
      f(s);
      this.reset = true;
    } else {
      this.start = i;
    }
  }
  return this;
};

Keccak.prototype.finalize = function () {
  var blocks = this.blocks, i = this.lastByteIndex, blockCount = this.blockCount, s = this.s;
  blocks[i >> 2] |= this.padding[i & 3];
  if (this.lastByteIndex === this.byteCount) {
    blocks[0] = blocks[blockCount];
    for (i = 1;i < blockCount + 1;++i) {
      blocks[i] = 0;
    }
  }
  blocks[blockCount - 1] |= 0x80000000;
  for (i = 0;i < blockCount;++i) {
    s[i] ^= blocks[i];
  }
  f(s);
};

Keccak.prototype.toString = Keccak.prototype.hex = function () {
  this.finalize();

  var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
  var hex = '', block;
  while (j < outputBlocks) {
    for (i = 0;i < blockCount && j < outputBlocks;++i, ++j) {
      block = s[i];
      hex += HEX_CHARS[(block >> 4) & 0x0F] + HEX_CHARS[block & 0x0F] +
             HEX_CHARS[(block >> 12) & 0x0F] + HEX_CHARS[(block >> 8) & 0x0F] +
             HEX_CHARS[(block >> 20) & 0x0F] + HEX_CHARS[(block >> 16) & 0x0F] +
             HEX_CHARS[(block >> 28) & 0x0F] + HEX_CHARS[(block >> 24) & 0x0F];
    }
    if (j % blockCount === 0) {
      f(s);
      i = 0;
    }
  }
  if (extraBytes) {
    block = s[i];
    if (extraBytes > 0) {
      hex += HEX_CHARS[(block >> 4) & 0x0F] + HEX_CHARS[block & 0x0F];
    }
    if (extraBytes > 1) {
      hex += HEX_CHARS[(block >> 12) & 0x0F] + HEX_CHARS[(block >> 8) & 0x0F];
    }
    if (extraBytes > 2) {
      hex += HEX_CHARS[(block >> 20) & 0x0F] + HEX_CHARS[(block >> 16) & 0x0F];
    }
  }
  return hex;
};

Keccak.prototype.buffer = function () {
  this.finalize();

  var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
  var bytes = this.outputBits >> 3;
  var buffer;
  if (extraBytes) {
    buffer = new ArrayBuffer((outputBlocks + 1) << 2);
  } else {
    buffer = new ArrayBuffer(bytes);
  }
  var array = new Uint32Array(buffer);
  while (j < outputBlocks) {
    for (i = 0;i < blockCount && j < outputBlocks;++i, ++j) {
      array[j] = s[i];
    }
    if (j % blockCount === 0) {
      f(s);
    }
  }
  if (extraBytes) {
    array[i] = s[i];
    buffer = buffer.slice(0, bytes);
  }
  return buffer;
};

Keccak.prototype.digest = Keccak.prototype.array = function () {
  this.finalize();

  var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
  var array = [], offset, block;
  while (j < outputBlocks) {
    for (i = 0;i < blockCount && j < outputBlocks;++i, ++j) {
      offset = j << 2;
      block = s[i];
      array[offset] = block & 0xFF;
      array[offset + 1] = (block >> 8) & 0xFF;
      array[offset + 2] = (block >> 16) & 0xFF;
      array[offset + 3] = (block >> 24) & 0xFF;
    }
    if (j % blockCount === 0) {
      f(s);
    }
  }
  if (extraBytes) {
    offset = j << 2;
    block = s[i];
    if (extraBytes > 0) {
      array[offset] = block & 0xFF;
    }
    if (extraBytes > 1) {
      array[offset + 1] = (block >> 8) & 0xFF;
    }
    if (extraBytes > 2) {
      array[offset + 2] = (block >> 16) & 0xFF;
    }
  }
  return array;
};

var f = function (s) {
  var h, l, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9,
      b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17,
      b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33,
      b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
  for (n = 0; n < 48; n += 2) {
    c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
    c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
    c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
    c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
    c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
    c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
    c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
    c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
    c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
    c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

    h = c8 ^ ((c2 << 1) | (c3 >>> 31));
    l = c9 ^ ((c3 << 1) | (c2 >>> 31));
    s[0] ^= h;
    s[1] ^= l;
    s[10] ^= h;
    s[11] ^= l;
    s[20] ^= h;
    s[21] ^= l;
    s[30] ^= h;
    s[31] ^= l;
    s[40] ^= h;
    s[41] ^= l;
    h = c0 ^ ((c4 << 1) | (c5 >>> 31));
    l = c1 ^ ((c5 << 1) | (c4 >>> 31));
    s[2] ^= h;
    s[3] ^= l;
    s[12] ^= h;
    s[13] ^= l;
    s[22] ^= h;
    s[23] ^= l;
    s[32] ^= h;
    s[33] ^= l;
    s[42] ^= h;
    s[43] ^= l;
    h = c2 ^ ((c6 << 1) | (c7 >>> 31));
    l = c3 ^ ((c7 << 1) | (c6 >>> 31));
    s[4] ^= h;
    s[5] ^= l;
    s[14] ^= h;
    s[15] ^= l;
    s[24] ^= h;
    s[25] ^= l;
    s[34] ^= h;
    s[35] ^= l;
    s[44] ^= h;
    s[45] ^= l;
    h = c4 ^ ((c8 << 1) | (c9 >>> 31));
    l = c5 ^ ((c9 << 1) | (c8 >>> 31));
    s[6] ^= h;
    s[7] ^= l;
    s[16] ^= h;
    s[17] ^= l;
    s[26] ^= h;
    s[27] ^= l;
    s[36] ^= h;
    s[37] ^= l;
    s[46] ^= h;
    s[47] ^= l;
    h = c6 ^ ((c0 << 1) | (c1 >>> 31));
    l = c7 ^ ((c1 << 1) | (c0 >>> 31));
    s[8] ^= h;
    s[9] ^= l;
    s[18] ^= h;
    s[19] ^= l;
    s[28] ^= h;
    s[29] ^= l;
    s[38] ^= h;
    s[39] ^= l;
    s[48] ^= h;
    s[49] ^= l;

    b0 = s[0];
    b1 = s[1];
    b32 = (s[11] << 4) | (s[10] >>> 28);
    b33 = (s[10] << 4) | (s[11] >>> 28);
    b14 = (s[20] << 3) | (s[21] >>> 29);
    b15 = (s[21] << 3) | (s[20] >>> 29);
    b46 = (s[31] << 9) | (s[30] >>> 23);
    b47 = (s[30] << 9) | (s[31] >>> 23);
    b28 = (s[40] << 18) | (s[41] >>> 14);
    b29 = (s[41] << 18) | (s[40] >>> 14);
    b20 = (s[2] << 1) | (s[3] >>> 31);
    b21 = (s[3] << 1) | (s[2] >>> 31);
    b2 = (s[13] << 12) | (s[12] >>> 20);
    b3 = (s[12] << 12) | (s[13] >>> 20);
    b34 = (s[22] << 10) | (s[23] >>> 22);
    b35 = (s[23] << 10) | (s[22] >>> 22);
    b16 = (s[33] << 13) | (s[32] >>> 19);
    b17 = (s[32] << 13) | (s[33] >>> 19);
    b48 = (s[42] << 2) | (s[43] >>> 30);
    b49 = (s[43] << 2) | (s[42] >>> 30);
    b40 = (s[5] << 30) | (s[4] >>> 2);
    b41 = (s[4] << 30) | (s[5] >>> 2);
    b22 = (s[14] << 6) | (s[15] >>> 26);
    b23 = (s[15] << 6) | (s[14] >>> 26);
    b4 = (s[25] << 11) | (s[24] >>> 21);
    b5 = (s[24] << 11) | (s[25] >>> 21);
    b36 = (s[34] << 15) | (s[35] >>> 17);
    b37 = (s[35] << 15) | (s[34] >>> 17);
    b18 = (s[45] << 29) | (s[44] >>> 3);
    b19 = (s[44] << 29) | (s[45] >>> 3);
    b10 = (s[6] << 28) | (s[7] >>> 4);
    b11 = (s[7] << 28) | (s[6] >>> 4);
    b42 = (s[17] << 23) | (s[16] >>> 9);
    b43 = (s[16] << 23) | (s[17] >>> 9);
    b24 = (s[26] << 25) | (s[27] >>> 7);
    b25 = (s[27] << 25) | (s[26] >>> 7);
    b6 = (s[36] << 21) | (s[37] >>> 11);
    b7 = (s[37] << 21) | (s[36] >>> 11);
    b38 = (s[47] << 24) | (s[46] >>> 8);
    b39 = (s[46] << 24) | (s[47] >>> 8);
    b30 = (s[8] << 27) | (s[9] >>> 5);
    b31 = (s[9] << 27) | (s[8] >>> 5);
    b12 = (s[18] << 20) | (s[19] >>> 12);
    b13 = (s[19] << 20) | (s[18] >>> 12);
    b44 = (s[29] << 7) | (s[28] >>> 25);
    b45 = (s[28] << 7) | (s[29] >>> 25);
    b26 = (s[38] << 8) | (s[39] >>> 24);
    b27 = (s[39] << 8) | (s[38] >>> 24);
    b8 = (s[48] << 14) | (s[49] >>> 18);
    b9 = (s[49] << 14) | (s[48] >>> 18);

    s[0] = b0 ^ (~b2 & b4);
    s[1] = b1 ^ (~b3 & b5);
    s[10] = b10 ^ (~b12 & b14);
    s[11] = b11 ^ (~b13 & b15);
    s[20] = b20 ^ (~b22 & b24);
    s[21] = b21 ^ (~b23 & b25);
    s[30] = b30 ^ (~b32 & b34);
    s[31] = b31 ^ (~b33 & b35);
    s[40] = b40 ^ (~b42 & b44);
    s[41] = b41 ^ (~b43 & b45);
    s[2] = b2 ^ (~b4 & b6);
    s[3] = b3 ^ (~b5 & b7);
    s[12] = b12 ^ (~b14 & b16);
    s[13] = b13 ^ (~b15 & b17);
    s[22] = b22 ^ (~b24 & b26);
    s[23] = b23 ^ (~b25 & b27);
    s[32] = b32 ^ (~b34 & b36);
    s[33] = b33 ^ (~b35 & b37);
    s[42] = b42 ^ (~b44 & b46);
    s[43] = b43 ^ (~b45 & b47);
    s[4] = b4 ^ (~b6 & b8);
    s[5] = b5 ^ (~b7 & b9);
    s[14] = b14 ^ (~b16 & b18);
    s[15] = b15 ^ (~b17 & b19);
    s[24] = b24 ^ (~b26 & b28);
    s[25] = b25 ^ (~b27 & b29);
    s[34] = b34 ^ (~b36 & b38);
    s[35] = b35 ^ (~b37 & b39);
    s[44] = b44 ^ (~b46 & b48);
    s[45] = b45 ^ (~b47 & b49);
    s[6] = b6 ^ (~b8 & b0);
    s[7] = b7 ^ (~b9 & b1);
    s[16] = b16 ^ (~b18 & b10);
    s[17] = b17 ^ (~b19 & b11);
    s[26] = b26 ^ (~b28 & b20);
    s[27] = b27 ^ (~b29 & b21);
    s[36] = b36 ^ (~b38 & b30);
    s[37] = b37 ^ (~b39 & b31);
    s[46] = b46 ^ (~b48 & b40);
    s[47] = b47 ^ (~b49 & b41);
    s[8] = b8 ^ (~b0 & b2);
    s[9] = b9 ^ (~b1 & b3);
    s[18] = b18 ^ (~b10 & b12);
    s[19] = b19 ^ (~b11 & b13);
    s[28] = b28 ^ (~b20 & b22);
    s[29] = b29 ^ (~b21 & b23);
    s[38] = b38 ^ (~b30 & b32);
    s[39] = b39 ^ (~b31 & b33);
    s[48] = b48 ^ (~b40 & b42);
    s[49] = b49 ^ (~b41 & b43);

    s[0] ^= RC[n];
    s[1] ^= RC[n + 1];
  }
};

window.storage = storage;

function digest(buf) {
  return new Link(sha3_256.buffer(buf));
}

function* save(value) {
  let buf = encode(value);
  let link = digest(buf);
  yield storage.set(link.toHex(), buf);
  return link;
}

function* load(link) {
  return decode(yield storage.get(link.toHex()));
}

let codes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// Loop over input 3 bytes at a time
// a,b,c are 3 x 8-bit numbers
// they are encoded into groups of 4 x 6-bit numbers
// aaaaaa aabbbb bbbbcc cccccc
// if there is no c, then pad the 4th with =
// if there is also no b then pad the 3rd with =
let map = [];
for (let i = 0, l = codes.length; i < l; i++) {
  map[codes.charCodeAt(i)] = i;
}

// loop over input 4 characters at a time
// The characters are mapped to 4 x 6-bit integers a,b,c,d
// They need to be reassembled into 3 x 8-bit bytes
// aaaaaabb bbbbcccc ccdddddd
// if d is padding then there is no 3rd byte
// if c is padding then there is no 2nd byte
function decode$1(data) {
  let bytes = [];
  let j = 0;
  for (let i = 0, l = data.length; i < l; i += 4) {
    let a = map[data.charCodeAt(i)];
    let b = map[data.charCodeAt(i + 1)];
    let c = map[data.charCodeAt(i + 2)];
    let d = map[data.charCodeAt(i + 3)];

    // higher 6 bits are the first char
    // lower 2 bits are upper 2 bits of second char
    bytes[j] = (a << 2) | (b >> 4);

    // if the third char is not padding, we have a second byte
    if (c < 64) {
      // high 4 bits come from lower 4 bits in b
      // low 4 bits come from high 4 bits in c
      bytes[j + 1] = ((b & 0xf) << 4) | (c >> 2);

      // if the fourth char is not padding, we have a third byte
      if (d < 64) {
        // Upper 2 bits come from Lower 2 bits of c
        // Lower 6 bits come from d
        bytes[j + 2] = ((c & 3) << 6) | d;
      }
    }
    j = j + 3;
  }
  return new Uint8Array(bytes);
}

let modeToType = {
   '40000': 0, // tree
  '040000': 0, // tree
  '100644': 1, // blob
  '100755': 2, // exec
  '120000': 3, // sym
  '160000': 4  // commit
};
let modeToImport = {
   '40000': importTree, // tree
  '040000': importTree, // tree
  '100644': importBlob, // blob
  '100755': importBlob, // exec
  '120000': importBlob, // sym
  '160000': importSubmodule  // commit
}

function decodeContent(content, encoding) {
  if (encoding !== "base64") {
    throw new Error("Unknown content encoding from github: " + encoding);
  }
  return decode$1(content);
}

function* importSubmodule(owner, repo, sha) {
  throw new Error(
    `TODO: Implement submodule importing: ${owner}/${repo}/${sha}`
  );
}

function* deref(owner, repo, ref) {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  var url=`https://api.github.com/repos/${owner}/${repo}/git/refs/${ref}`;
  let result = yield (yield fetch(url)).json();
  return result.object.sha;
}

function* gitLoad(owner, repo, type, sha) {
  let result = yield storage.get(sha);
  if (result) return result;
  var url=`https://api.github.com/repos/${owner}/${repo}/git/${type}s/${sha}`;
  result = yield (yield fetch(url)).json();
  yield storage.set(sha, result);
  return result;
}

function* importBlob(owner, repo, sha, filename) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, "blob", sha);
  let file = {
    file: decodeContent(result.content, result.encoding)
  };
  if (filename) file.name = filename;
  return yield* save(file);
}

function* importTree(owner, repo, sha, filename) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, "tree", sha);
  let tasks = [];
  for (let entry of result.tree) {
    tasks.push(modeToImport[entry.mode](owner, repo, entry.sha, entry.path));
  }
  let entries = (yield runAll(tasks)).map(function (link, i) {
    let entry = result.tree[i];
    return [
      modeToType[entry.mode],
      entry.path,
      link
    ];
  });
  let tree = {tree:entries}
  if (filename) tree.name = filename;
  return yield* save(tree);
}

function* importCommit(owner, repo, sha) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, "commit", sha);
  let release = {
    root: yield* importTree(owner, repo, result.tree.sha)
  };
  return yield* save(release);
}

run(function*() {
  let owner = "creationix";
  let repo = "conquest";
  let ref = "heads/master";
  console.log(`Importing github://${owner}/${repo}/refs/${ref}`);
  let link = yield* importCommit(owner, repo, ref);
  console.log(`Imported as ${link.toHex()}`);
  console.log(yield* load(link));
}());

}());
//# sourceMappingURL=bundle.js.map

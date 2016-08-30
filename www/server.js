'use strict';

var net = require('net');
var fs = require('fs');

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

function makeRead(socket, decode) {

  // If writer > reader, there is data to be read.
  // if reader > writer, there is data required.
  let queue = [];
  let reader = 0, writer = 0;

  // null = not started, true = flowing, false = paused
  let state = null;

  // buffer to store leftover data between decoder calls.
  let buffer;

  read.updateDecode = (newDecode) => { decode = newDecode };

  return read;

  function read() {
    // If there is pending data, return it right away.
    if (writer > reader) return queue[reader++];

    // Make sure the data is flowing since we need it.
    if (state === null) {
      state = true;
      // console.log("Starting");
      socket.on('data', onData);
      socket.on('end', onData);
    }
    else if (state === false) {
      state = true;
      // console.log("Resuming");
      socket.resume();
    }

    // Wait for the data or a parse error.
    return new Promise(function (resolve) {
      queue[reader++] = resolve;
    });
  }

  function onData(chunk) {
    // Convert node buffer to portable Uint8Array
    if (chunk) chunk = new Uint8Array(chunk);
    if (!decode) { onValue(chunk); return; }
    buffer = decode.concat(buffer, chunk);
    let out;
    while ((out = decode(buffer))) {
      // console.log("OUT", out);
      buffer = out[1];
      onValue(out[0]);
    }
    // console.log("Done parsing");
  }

  function onValue(value) {
    // If there is a pending writer, give it the data right away.
    if (reader > writer) {
      queue[writer++](value);
      return;
    }

    // Pause the read stream if we're buffering data already.
    if (state && writer > reader) {
      state = false;
      // console.log("Pausing");
      socket.pause();
    }

    queue[writer++] = value;
  }
}

function makeWrite(socket, encode) {

  write.updateEncode = function (newEncode) {
    encode = newEncode;
  };

  return write;

  function write(value) {
    if (encode) value = encode(value);
    if (value) socket.write(Buffer(value));
    else socket.end();
  }
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

const codes =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
// Reverse map from character code to 6-bit integer
let map = [];
for (let i = 0, l = codes.length; i < l; i++) {
  map[codes.charCodeAt(i)] = i;
}

// This takes nested lists of numbers, strings and array buffers and returns
// a single buffer.  Numbers represent single bytes, strings are raw 8-bit
// strings, and buffers represent themselves.
// EX:
//    1           -> <01>
//    "Hi"        -> <48 69>
//    [1, "Hi"]   -> <01 48 69>
//    [[1],2,[3]] -> <01 02 03>
function flatten(parts) {
  if (typeof parts === "number") return new Uint8Array([parts]);
  if (parts instanceof Uint8Array) return parts;
  let buffer = new Uint8Array(count(parts));
  copy(buffer, 0, parts);
  return buffer;
}

function count(value) {
  if (value == null) return 0;
  if (typeof value === "number") return 1;
  if (typeof value === "string") return value.length;
  if (value instanceof Uint8Array) return value.length;
  if (!Array.isArray(value)) {
    throw new TypeError("Bad type for flatten: " + typeof value);
  }
  let sum = 0;
  for (let piece of value) {
    sum += count(piece);
  }
  return sum;
}

function copy(buffer, offset, value) {
  if (value == null) return offset;
  if (typeof value === "number") {
    buffer[offset++] = value;
    return offset;
  }
  if (typeof value === "string") {
    for (let i = 0, l = value.length; i < l; i++) {
      buffer[offset++] = value.charCodeAt(i);
    }
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


// indexOf for arrays/buffers.  Raw is a string in raw encoding.
// returns -1 when not found.
// start and end are indexes into buffer.  Default is 0 and length.
function indexOf(bin, raw, start, end) {
  start = start == null ? 0 : start | 0;
  end = end == null ? bin.length : end | 0;
  outer: for (let i = start || 0; i < end; i++) {
    for (let j = 0, l = raw.length; j < l; j++) {
      if (i + j >= end || bin[i + j] !== raw.charCodeAt(j)) {
        continue outer;
      }
    }
    return i;
  }
  return -1;
}

// lua-style assert helper
function assert(val, message) { if (!val) throw new Error(message); }

let STATUS_CODES = {
  '100': 'Continue',
  '101': 'Switching Protocols',
  '102': 'Processing',                 // RFC 2518, obsoleted by RFC 4918
  '200': 'OK',
  '201': 'Created',
  '202': 'Accepted',
  '203': 'Non-Authoritative Information',
  '204': 'No Content',
  '205': 'Reset Content',
  '206': 'Partial Content',
  '207': 'Multi-Status',               // RFC 4918
  '300': 'Multiple Choices',
  '301': 'Moved Permanently',
  '302': 'Moved Temporarily',
  '303': 'See Other',
  '304': 'Not Modified',
  '305': 'Use Proxy',
  '307': 'Temporary Redirect',
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '402': 'Payment Required',
  '403': 'Forbidden',
  '404': 'Not Found',
  '405': 'Method Not Allowed',
  '406': 'Not Acceptable',
  '407': 'Proxy Authentication Required',
  '408': 'Request Time-out',
  '409': 'Conflict',
  '410': 'Gone',
  '411': 'Length Required',
  '412': 'Precondition Failed',
  '413': 'Request Entity Too Large',
  '414': 'Request-URI Too Large',
  '415': 'Unsupported Media Type',
  '416': 'Requested Range Not Satisfiable',
  '417': 'Expectation Failed',
  '418': "I'm a teapot",               // RFC 2324
  '422': 'Unprocessable Entity',       // RFC 4918
  '423': 'Locked',                     // RFC 4918
  '424': 'Failed Dependency',          // RFC 4918
  '425': 'Unordered Collection',       // RFC 4918
  '426': 'Upgrade Required',           // RFC 2817
  '500': 'Internal Server Error',
  '501': 'Not Implemented',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',
  '504': 'Gateway Time-out',
  '505': 'HTTP Version not supported',
  '506': 'Variant Also Negotiates',    // RFC 2295
  '507': 'Insufficient Storage',       // RFC 4918
  '509': 'Bandwidth Limit Exceeded',
  '510': 'Not Extended'                // RFC 2774
};

function encoder() {
  let mode;

  function encodeHead(item) {
    if (!item || item.constructor !== Object) {
      return item;
    }
    else if (typeof item !== 'object') {
      throw new Error(
        "expected an object but got a " + (typeof item) + " when encoding data"
      );
    }
    let head, chunkedEncoding;
    let version = item.version || 1.1;
    if (item.method) {
      let path = item.path;
      assert(path && path.length > 0, "expected non-empty path");
      head = [ item.method + ' ' + item.path + ' HTTP/' + version + '\r\n' ];
    }
    else {
      let reason = item.reason || STATUS_CODES[item.code];
      head = [ 'HTTP/' + version + ' ' + item.code + ' ' + reason + '\r\n' ];
    }
    let headers = item.headers;
    if (Array.isArray(headers)) {
      for (let i = 0, l = headers.length; i < l; i += 2) {
        processHeader(headers[i], headers[i + 1]);
      }
    }
    else {
      for (let key in headers) {
        processHeader(key, headers[key]);
      }
    }
    function processHeader(key, value) {
      let lowerKey = key.toLowerCase();
      if (lowerKey === "transfer-encoding") {
        chunkedEncoding = value.toLowerCase() === "chunked";
      }
      value = (''+value).replace(/[\r\n]+/, ' ');
      head[head.length] = key + ': ' + value + '\r\n';
    }

    head[head.length] = '\r\n';

    mode = chunkedEncoding && encodeChunked || encodeRaw;
    return head.join('');
  }

  function encodeRaw(item) {
    if (typeof item !== "string") {
      mode = encodeHead;
      return encodeHead(item);
    }
    return item;
  }

  function encodeChunked(item) {
    if (typeof item !== "string") {
      mode = encodeHead;
      let extra = encodeHead(item);
      if (extra) {
        return "0\r\n\r\n" + extra;
      }
      else {
        return "0\r\n\r\n";
      }
    }
    if (item.length === 0) {
      mode = encodeHead;
    }
    return item.length.toString(16) + "\r\n" + item + "\r\n";
  }

  mode = encodeHead;
  function encode(item) {
    return mode(item);
  }
  return encode;
}

function slice(chunk, start, end) {
  if (typeof end !== 'number') end = chunk.length;
  if ((end - start) > 0) return chunk.slice(start, end);
}

function decoder() {

  // This decoder is somewhat stateful with 5 different parsing states.
  let mode; // state variable that points to various decoders
  let bytesLeft; // For counted decoder

  // This state is for decoding the status line and headers.
  function decodeHead(chunk) {
    if (!chunk) return;

    let index = indexOf(chunk, "\r\n\r\n");
    // First make sure we have all the head before continuing
    if (index < 0) {
      if (chunk.length < 8 * 1024) return;
      // But protect against evil clients by refusing heads over 8K long.
      throw new Error("entity too large");
    }
    let tail = chunk.slice(index + 4);

    // Parse the status/request line
    let head = {};

    index = indexOf(chunk, "\n") + 1;
    let line = binToRaw(chunk, 0, index);
    let match = line.match(/^HTTP\/(\d\.\d) (\d+) ([^\r\n]+)/);
    if (match) {
      head.code = parseInt(match[2]);
      head.reason = match[3];
    }
    else {
      match = line.match(/^([A-Z]+) ([^ ]+) HTTP\/(\d\.\d)/);
      if (match) {
        head.method = match[1];
        head.path = match[2];
      }
      else {
        throw new Error("expected HTTP data");
      }
    }
    head.version = parseFloat(match[3]);
    head.keepAlive = head.version > 1.0;

    // We need to inspect some headers to know how to parse the body.
    let contentLength;
    let chunkedEncoding;

    let headers = head.headers = [];
    // Parse the header lines
    let start = index;
    while ((index = indexOf(chunk, "\n", index) + 1)) {
      line = binToRaw(chunk, start, index);
      if (line === '\r\n') break;
      start = index;
      match = line.match(/^([^:\r\n]+): *([^\r\n]+)/);
      if (!match) {
        throw new Error("Malformed HTTP header: " + line);
      }
      let key = match[1],
          value = match[2];
      let lowerKey = key.toLowerCase();

      // Inspect a few headers and remember the values
      if (lowerKey === "content-length") {
        contentLength = parseInt(value);
      }
      else if (lowerKey === "transfer-encoding") {
        chunkedEncoding = value.toLowerCase() === "chunked";
      }
      else if (lowerKey === "connection") {
        head.keepAlive = value.toLowerCase() === "keep-alive";
      }
      headers.push(key, value);
    }

    if (head.keepAlive ?
        !(chunkedEncoding ||
          (contentLength !== undefined && contentLength > 0)
        ) :
        (head.method === "GET" || head.method === "HEAD")) {
      mode = decodeEmpty;
    }
    else if (chunkedEncoding) {
      mode = decodeChunked;
    }
    else if (contentLength !== undefined) {
      bytesLeft = contentLength;
      mode = decodeCounted;
    }
    else if (!head.keepAlive) {
      mode = decodeRaw;
    }
    return [head, tail];

  }

  // This is used for inserting a single empty string into the output string for known empty bodies
  function decodeEmpty(chunk) {
    mode = decodeHead;
    return [new Uint8Array(0), chunk];
  }

  function decodeRaw(chunk) {
    if (!chunk) return [new Uint8Array(0)];
    if (chunk.length === 0) return;
    return [chunk];
  }

  function decodeChunked(chunk) {
    // Make sure we have at least the length header
    let index = indexOf(chunk, '\r\n');
    if (index < 0) return;

    // And parse it
    let hex = binToRaw(chunk, 0, index);
    let length = parseInt(hex, 16);

    // Wait till we have the rest of the body
    let start = hex.length + 2;
    let end = start + length;
    if (chunk.length < end + 2) return;

    // An empty chunk means end of stream; reset state.
    if (length === 0) mode = decodeHead;

    // Make sure the chunk ends in '\r\n'
    assert(binToRaw(chunk, end, end + 2) == '\r\n', 'Invalid chunk tail');

    return [chunk.slice(start, end), slice(chunk, end + 2)];
  }

  function decodeCounted(chunk) {
    if (bytesLeft === 0) {
      mode = decodeEmpty;
      return mode(chunk);
    }
    let length = chunk.length;
    // Make sure we have at least one byte to process
    if (!length) return;

    if (length >= bytesLeft) mode = decodeEmpty;

    // If the entire chunk fits, pass it all through
    if (length <= bytesLeft) {
      bytesLeft -= length;
      return [chunk];
    }

    return [chunk.slice(0, bytesLeft), slice(chunk, bytesLeft + 1)];
  }

  // Switch between states by changing which decoder mode points to
  mode = decodeHead;
  function decode(chunk) {
    return mode(chunk);
  }
  decode.concat = concat;
  return decode;
}

function concat(buffer, chunk) {
  return buffer ? flatten([buffer, chunk]) : chunk;
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

const codes$1 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
// Reverse map from character code to 6-bit integer
let map$1 = [];
for (let i$1 = 0, l$1 = codes$1.length; i$1 < l$1; i$1++) {
  map$1[codes$1.charCodeAt(i$1)] = i$1;
}

// This takes nested lists of numbers, strings and array buffers and returns
// a single buffer.  Numbers represent single bytes, strings are raw 8-bit
// strings, and buffers represent themselves.
// EX:
//    1           -> <01>
//    "Hi"        -> <48 69>
//    [1, "Hi"]   -> <01 48 69>
//    [[1],2,[3]] -> <01 02 03>
function flatten$1(parts) {
  if (typeof parts === "number") return new Uint8Array([parts]);
  if (parts instanceof Uint8Array) return parts;
  let buffer = new Uint8Array(count$1(parts));
  copy$1(buffer, 0, parts);
  return buffer;
}

function count$1(value) {
  if (value == null) return 0;
  if (typeof value === "number") return 1;
  if (typeof value === "string") return value.length;
  if (value instanceof Uint8Array) return value.length;
  if (!Array.isArray(value)) {
    throw new TypeError("Bad type for flatten: " + typeof value);
  }
  let sum = 0;
  for (let piece of value) {
    sum += count$1(piece);
  }
  return sum;
}

function copy$1(buffer, offset, value) {
  if (value == null) return offset;
  if (typeof value === "number") {
    buffer[offset++] = value;
    return offset;
  }
  if (typeof value === "string") {
    for (let i = 0, l = value.length; i < l; i++) {
      buffer[offset++] = value.charCodeAt(i);
    }
    return offset;
  }
  if (value instanceof ArrayBuffer) {
    value = new Uint8Array(value);
  }
  for (let piece of value) {
    offset = copy$1(buffer, offset, piece);
  }
  return offset;
}

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

class Request {
  constructor (head) {
    head = head || {};
    this.method = head.method || 'GET';
    this.path = head.path || "/";
    this.version = head.version || 1.1;
    this.keepAlive = head.keepAlive || false;
    this.headers = new Headers(head.headers);
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
class Response{
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

function parseQuery(query) {
  let params = {}
  for (let part of query.split("&")) {
    let match = part.match(/^([^=]+)=(.*)$/)
    if (!match) continue;
    let key = decodeURIComponent(match[1]),
        value = decodeURIComponent(match[2]);
    params[key] = value;
  }
  return params;
}

function escapeRegex(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function compileGlob(glob) {
  let reg = new RegExp(glob.split("*").map(escapeRegex).join(".*"));
  return function (string) {
    return reg.test(string)
  }
}

function compileRoute(route) {
  let names = [];
  let reg = new RegExp(route.split(/(:[a-z0-9_]+:?)/).map(function (part, i) {
    if (i % 2) {
      if (part[part.length - 1] === ':') {
        names.push(part.substr(1, -2));
        return "(.+)";
      }
      names.push(part.substr(1));
      return "([^/]+)";
    }
    return escapeRegex(part);
  }).join(""));
  return function (str) {
    let match = str.match(reg);
    if (!match) return;
    let params = {};
    for (let i = 0, l = names.length; i < l; i++) {
      params[names[i]] = match[i + 1];
    }
    return params;
  }
}

class Server {
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
      let server = net.createServer(socket => {
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
      if (res.body) write(flatten$1(res.body));
      write("");
      if (!chunk) break;
    }
    socket.close();
  }
  *runLayer(index, req, res) {
    let layer = this.layers[index];
    console.log(layer);
    if (!layer) return;
    let self = this;
    return yield* layer(req, res, function*() {
      return yield* self.runLayer(index + 1, req, res);
    });
  }

}

function* logger(req, res, next) {
  let userAgent = req.headers.get("User-Agent");

  // Run all inner layers first.
  yield* next();

  // And then log after everything is done
  if (userAgent) {
    // Skip this layer for clients who don't send User-Agent headers.
    console.log(`${req.method} ${req.path} ${userAgent} ${res.code}`);
  }
}

function* autoHeaders(req, res, next) {
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
    let body = res.body = flatten$1(res.body);
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

function files(root) {
  let m = module;
  while (m.parent) m = m.parent;
  if (root[0] !== '/') root = pathJoin(m.filename, "..", root);
  return function* (req, res, next) {
    let path = pathJoin(root, req.pathname);
    let data = yield new Promise(function (resolve, reject) {
      fs.readFile(path, onRead);
      function onRead(err, data) {
        if (err) {
          if (err.code === "ENOENT") return resolve();
          if (err.code === "EISDIR") {
            path = pathJoin(path, "index.html");
            return fs.readFile(path, onRead);
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

new Server()
  .use(logger)      // To log requests to stdout
  .use(autoHeaders) // To ensure we send proper HTTP headers
  .use(files("."))  // To serve up the client-side app
  .route({          // To handle logic
    method: "GET",
    path: "/:name"
  }, function* (req, res) {
    res.code = 200;
    res.body = `Hi ${req.params.name}!`;
  })
  .start();
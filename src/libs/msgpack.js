import { flatten, strToBin, binToStr } from "./bintools"

let extensions = [];
let extdex = {};

export function register(code, Constructor, encoder, decoder) {
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


export function encode(value) {
  return flatten(realEncode(value));
}

function pairMap(key) {
  return [
    realEncode(key),
    realEncode(this[key])
  ];
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
    value = strToBin(value);
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

export function decode(buf) {
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

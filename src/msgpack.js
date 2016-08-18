import { flatten } from "./flatten"

let extensions = [];

export function register(code, Constructor, encoder, decoder) {
  extensions.push({
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
      if (value > -0x20) return 0xe0 | -value;
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

  throw new TypeError("Unknown type: " + Object.prototype.toString.call(value));
}

export function decode(buf) {

}

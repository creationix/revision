import { flatten, strToRaw, binToStr, strToBin, binToRaw, rawToBin, indexOf } from "./bintools"

export function encode(list) {
  let len = list.length;
  let parts = ['*' + len];
  for (let i = 0; i < len; i++) {
    let part = list[i];
    if (part == null) {
      parts.push('\r\n*-1');
    }
    else if (typeof part === 'number') {
      parts.push('\r\n:' + part);
    }
    else if (part instanceof Error) {
      parts.push('\r\n-' + part.message);
      continue
    }
    else if (part instanceof Uint8Array) {
      parts.push('\r\n$' + part.length + '\r\n', part);
    }
    else {
      part = strToRaw('' + part);
      if (/\r\n/.test(part)) {
        parts.push('\r\n$' + part.length + '\r\n' + part);
      }
      else {
        parts.push('\r\n+' + part);
      }
    }
  }
  parts.push('\r\n');
  return flatten(parts);
}

export function decode(chunk) {
  let out = innerDecode(chunk, 0);
  if (!out) return;
  return (out[1] < chunk.length) ?
    [out[0], chunk.slice(out[1])] :
    [out[0]];
}

function innerDecode(chunk, offset) {
  if (chunk.length <= offset) return;
  switch(chunk[offset]) {
    case 43: { // '+' Simple string
      let index = indexOf(chunk, '\r\n', offset);
      if (index < 0) return;
      return [
        binToRaw(chunk, offset + 1, index),
        index + 2
      ];
    }
    case 45: { // '-' Error
      let index = indexOf(chunk, '\r\n', offset);
      if (index < 0) return;
      return [
        new Error(binToStr(chunk, offset + 1, index)),
        index + 2
      ];
    }
    case 58: { // ':' Integer
      let index = indexOf(chunk, '\r\n', offset);
      if (index < 0) return;
      return [
        parseInt(binToRaw(chunk, offset + 1, index), 10),
        index + 2
      ];
    }
    case 36: { // '$' Bulk String
      let index = indexOf(chunk, '\r\n', offset);
      if (index < 0) return;
      let len = parseInt(binToRaw(chunk, offset + 1, index), 10);
      let start = index + 2,
          end = start + len;
      if (chunk.length < end + 2) return;
      return [
        binToRaw(chunk, start, end),
        end + 2
      ];
    }
    case 42: { // '*' List
      let index = indexOf(chunk, '\r\n', offset);
      if (index < 0) return;
      let len = parseInt(binToRaw(chunk, offset + 1, index), 10);
      if (len < 0) return [
        null,
        index + 2
      ];
      let list = [];
      offset = index + 2;
      while (len--) {
        let out = innerDecode(chunk, offset);
        if (!out) return;
        list.push(out[0]);
        offset = out[1];
      }
      return [
        list,
        offset
      ];
    }
    default: {
      let index = indexOf(chunk, '\r\n', offset);
      if (index < 0) return;
      let str = binToRaw(chunk, offset, index);
      return [
        str.split(' '),
        index + 2
      ];
    }
  }
}

import { assert } from "./assert"

export function test() {

  function testDecode(input, expected) {
    input = rawToBin(input);
    console.log("Input   :", input);
    if (expected && expected[1]) expected[1] = rawToBin(expected[1]);
    console.log("Expected:", expected);
    let actual = decode(input);
    console.log("Actual:  ", actual);
    assert(JSON.stringify(expected) == JSON.stringify(actual));
  }

  testDecode("*2\r\n*1\r\n+Hello\r\n+World\r\n", [
    [["Hello"],"World"]
  ])
  testDecode("*2\r\n*1\r\n$5\r\nHello\r\n$5\r\nWorld\r\n", [
    [["Hello"],"World"]
  ])
  testDecode("set language Lua\r\n", [
    ["set", "language", "Lua"]
  ])
  testDecode("$5\r\n12345\r\n", [
    "12345"
  ])
  testDecode("$5\r\n12345\r")
  testDecode("$5\r\n12345\r\nabc", [
    "12345",
    "abc"
  ])
  testDecode("+12")
  testDecode("+1234\r")
  testDecode("+1235\r\n", [
    "1235"
  ])
  testDecode("+1235\r\n1234", [
    "1235",
    "1234"
  ])
  testDecode(":45\r")
  testDecode(":45\r\n", [
    45
  ])
  testDecode("*-1\r\nx", [
    null,
    "x"
  ])
  testDecode("-FATAL, YIKES\r\n", [
    new Error("FATAL, YIKES")
  ])
  testDecode("*12\r\n$4\r\n2048\r\n$1\r\n0\r\n$4\r\n1024\r\n$2\r\n42\r\n$1\r\n5\r\n$1\r\n7\r\n$1\r\n5\r\n$1\r\n7\r\n$1\r\n5\r\n$1\r\n7\r\n$1\r\n5\r\n$1\r\n7\r\n", [
    ['2048', '0', '1024', '42', '5', '7', '5', '7', '5', '7', '5', '7' ]
  ])

  console.log(binToRaw(encode([1,2,null,"HI",4])))
  console.log(decode(encode([1,2,null,"HI",4]))[0])
}
// test()

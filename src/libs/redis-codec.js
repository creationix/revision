import {
  flatten, strToBin, binToStr, binToRaw, rawToBin, indexOf
} from "./bintools"

// Values come in, Uint8Array comes out
export function encode(value) {
  if (value === undefined) return;
  return flatten(realEncode(value));
}

function realEncode(value) {
  if (value === null) {
    return '*-1\r\n';
  }
  else if (typeof value === 'number') {
    return ':' + value + '\r\n';
  }
  else if (value instanceof Error) {
    return '-' + value.message + '\r\n';
  }
  else if (Array.isArray(value)) {
    return ['*' + value.length + '\r\n', value.map(realEncode)];
  }
  else {
    if (!(value instanceof Uint8Array)) {
      value = strToBin('' + value);
    }
    return ['$' + value.length + '\r\n', value, '\r\n'];
  }
}

// Uint8Array comes in, [value, extra] comes out.
// Extra is undefined if there was no extra input.
export function decode(chunk) {
  if (!chunk) return;
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
      if (len < 0) return [
        null,
        index + 2
      ];
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

  let decodeTests = [
    "*2\r\n*1\r\n+Hello\r\n+World\r\n", [
      [["Hello"],"World"]
    ],
    "*2\r\n*1\r\n$5\r\nHello\r\n$5\r\nWorld\r\n", [
      [["Hello"],"World"]
    ],
    "set language Lua\r\n", [
      ["set", "language", "Lua"]
    ],
    "$5\r\n12345\r\n", [
      "12345"
    ],
    "$5\r\n12345\r", undefined,
    "$5\r\n12345\r\nabc", [
      "12345",
      "abc"
    ],
    "+12", undefined,
    "+1234\r", undefined,
    "+1235\r\n", [
      "1235"
    ],
    "+1235\r\n1234", [
      "1235",
      "1234"
    ],
    ":45\r", undefined,
    ":45\r\n", [
      45
    ],
    "*-1\r\nx", [
      null,
      "x"
    ],
    "-FATAL, YIKES\r\n", [
      new Error("FATAL, YIKES")
    ],
    "*12\r\n$4\r\n2048\r\n$1\r\n0\r\n$4\r\n1024\r\n$2\r\n42\r\n$1\r\n5\r\n$1\r\n7\r\n$1\r\n5\r\n$1\r\n7\r\n$1\r\n5\r\n$1\r\n7\r\n$1\r\n5\r\n$1\r\n7\r\n", [
      ['2048', '0', '1024', '42', '5', '7', '5', '7', '5', '7', '5', '7' ]
    ]
  ];

  for (let i = 0, l = decodeTests.length; i < l; i += 2) {
    let input = rawToBin(decodeTests[i]);
    console.log("Input   :", input);
    let expected = decodeTests[i + 1];
    if (expected && expected[1]) expected[1] = rawToBin(expected[1]);
    console.log("Expected:", expected);
    let actual = decode(input);
    console.log("Actual:  ", actual);
    assert(JSON.stringify(expected) == JSON.stringify(actual));
  }

  let values = [
    "Hello",
    null,
    10, -10,
    "With\r\nNewline",
    [1,2,3,4]
  ];

  console.log("\nEncode tests:");
  for (let value of values) {
    console.log('\nInput:  ', value);
    let encoded = encode(value);
    console.log('Encoded:', [binToRaw(encoded)]);
    let decoded = decode(encoded);
    console.log('Decoded:', decoded);
  }

}
// import { addInspect } from "./bintools"; addInspect();
// test()

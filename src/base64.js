let codes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// Loop over input 3 bytes at a time
// a,b,c are 3 x 8-bit numbers
// they are encoded into groups of 4 x 6-bit numbers
// aaaaaa aabbbb bbbbcc cccccc
// if there is no c, then pad the 4th with =
// if there is also no b then pad the 3rd with =
export function encode(buf) {
  let str = "";
  for (let i = 0, l = buf.length; i < l; i += 3) {
    let a = buf[i],
        b = i + 1 < l ? buf[i + 1] : -1,
        c = i + 2 < l ? buf[i + 2] : -1;
    str +=
      // Higher 6 bits of a
      codes[a >> 2] +
      // Lower 2 bits of a + high 4 bits of b
      codes[((a & 3) << 4) | (b >= 0 ? b >> 4 : 0)] +
      // Low 4 bits of b + High 2 bits of c
      (b >= 0 ? codes[((b & 15) << 2) | (c >= 0 ? c >> 6 : 0)] : "=") +
      // Lower 6 bits of c
      (c >= 0 ? codes[c & 63] : "=");
  }
  return str;
}

// Reverse map from character code to 6-bit integer
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
export function decode(data) {
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

function testEncode(input, expected) {
  let buf = new Uint8Array(input.length);
  for (let i = 0, l = input.length; i < l; i++) {
    buf[i] = input.charCodeAt(i);
  }
  let actual = encode(buf);
  if (actual !== expected) {
    console.error({
      input: input,
      expected: expected,
      actual: actual
    });
    throw new Error("Encode failed");
  }
}

function testDecode(input, expected) {
  let buf = decode(input);
  let actual = "";
  for (let i = 0, l = buf.length; i < l; i++) {
    actual += String.fromCharCode(buf[i]);
  }
  if (actual !== expected) {
    console.error({
      input: input,
      expected: expected,
      actual: actual
    });
    throw new Error("Decode failed");
  }
}

export function test() {
  testEncode("", "");
  testEncode("f", "Zg==");
  testEncode("fo", "Zm8=");
  testEncode("foo", "Zm9v");
  testEncode("foob", "Zm9vYg==");
  testEncode("fooba", "Zm9vYmE=");
  testEncode("foobar", "Zm9vYmFy");

  testDecode("", "");
  testDecode("Zg==", "f");
  testDecode("Zm8=", "fo");
  testDecode("Zm9v", "foo");
  testDecode("Zm9vYg==", "foob");
  testDecode("Zm9vYmE=", "fooba");
  testDecode("Zm9vYmFy", "foobar");
}

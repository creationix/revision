import { sha3_256 } from "./sha3";
// import { run } from "./async";

import { register, encode, decode } from "./msgpack";

// Register the Link type so we can serialize hashes as a new special type.
// hash itself is just a 32 byte Uint8Array
function Link(hash) {
  this.hash = new Uint8Array(hash);
}
register(127, Link,
  (link) => { return link.hash; },
  (buf) => { return new Link(buf); }
);

let hash = sha3_256.buffer("Hello World");
let link = new Link(hash);


let tests = [
  true,
  false,
  null,
  "Hello",
  [1, 2, 3],
  link,
  new Uint8Array([1,2,3]),
  {name:"Tim"},
  {
    isProgrammer: true,
    badParts: null,
    name: "Tim",
    age: 34,
    message: link
  }
];

function serialize(value) {
  return Object.prototype.toString.call(value)+value;
}

for (let test of tests) {
  console.log("Expected", test);
  let encoded = encode(test);
  console.log("Encoded", encoded);
  let decoded = decode(encoded);
  console.log("Actual", decoded);
  if (serialize(test) !== serialize(decoded)) {
    throw new Error("MISMATCH");
  }
}

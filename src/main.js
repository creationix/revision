import { sha3_256 } from "./sha3";
// import { run } from "./async";

import { register, encode } from "./msgpack";

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

let encoded = encode({
  name: "Tim",
  age: 34,
  message: link
});
console.log("encoded", encoded);

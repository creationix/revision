// import { sha3_256 } from "./sha3";
import { run } from "./async";
import { register, encode, decode } from "./msgpack";
import { idbKeyval as storage } from "./idb-keyval";

// Register the Link type so we can serialize hashes as a new special type.
// hash itself is just a 32 byte Uint8Array
function Link(hash) {
  this.hash = new Uint8Array(hash);
}
register(127, Link,
  (link) => { return link.hash; },
  (buf) => { return new Link(buf); }
);

run(function*() {
  yield storage.set("test", encode([1,2,3]));
  let out = decode(yield storage.get("test"));
  console.log(out);
}())

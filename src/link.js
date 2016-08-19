import { register } from "./msgpack";
import { load } from "./cas";

// Register the Link type so we can serialize hashes as a new special type.
// hash itself is just a 32 byte Uint8Array
register(127, Link,
  (link) => { return link.hash; },
  (buf) => { return new Link(buf); }
);

// Link has some nice methods in addition to storing the hash buffer.
export function Link(hash) {
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

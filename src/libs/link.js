import { register, encode, decode } from "./msgpack";
import { sha1 } from "./sha1";

// Consumers of this API must provide the following interface here.
// function get(hash) -> promise<value>
// function set(hash, value) -> promise
export let storage = {};

// Register the Link type so we can serialize hashes as a new special type.
// hash itself is just a 20 byte Uint8Array
register(127, Link,
  (link) => { return link.hash; },
  (buf) => { return new Link(buf); }
);

// Save takes a value and serializes and stores it returning the link.
export function* save(value) {
  let buf = encode(value);
  let hex = sha1(buf);
  yield storage.set(hex, buf);
  return new Link(hex);
}

// Load accepts a link or a string hash as input.
export function* load(link) {
  let hex = typeof link === "string" ?
    link : link.toHex();
  return decode(yield storage.get(hex));
}

// Link has some nice methods in addition to storing the hash buffer.
export function Link(hash) {
  if (hash.constructor === ArrayBuffer) {
    hash = new Uint8Array(hash);
  }
  if (hash.constructor === Uint8Array) {
    this.hash = hash;
    return;
  }
  if (typeof hash === "string") {
    if (!/^[0-9a-f]{40}$/.test(hash)) {
      throw new TypeError("Invalid string, expected hash");
    }
    this.hash = new Uint8Array(20);
    let j = 0;
    for (let i = 0; i < 40; i += 2) {
      this.hash[j++] = parseInt(hash.substr(i, 2), 16);
    }
    return;
  }
  throw new TypeError("Invalid hash, expected string or buffer");
}
Link.prototype.resolve = function* resolve() {
  return yield* load(this);
};
Link.prototype.toHex = function toHex() {
  let hex = "";
  let buf = this.hash;
  for (let i = 0, l = buf.length; i < l; i++) {
    let byte = buf[i];
    hex += (byte < 0x10 ? "0" : "") + byte.toString(16);
  }
  if (!hex) throw new Error("WAT")
  return hex;
};

// Look for links in an object
export function scan(value, onLink) {
  if (value.constructor === Link) {
    onLink(value);
  }
  else if (Array.isArray(value)) {
    for (let item of value) scan(item, onLink);
  }
  else if (value.constructor === Object) {
    for (let key in value) {
      scan(value[key], onLink);
    }
  }
}
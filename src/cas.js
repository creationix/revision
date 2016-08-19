import { Link } from "./link";
import { encode, decode } from "./msgpack";
import { idbKeyval as storage } from "./idb-keyval";
import { sha3_256 } from "./sha3";
window.storage = storage;

function digest(buf) {
  return new Link(sha3_256.buffer(buf));
}

export function* save(value) {
  let buf = encode(value);
  let link = digest(buf);
  yield storage.set(link.toHex(), buf);
  return link;
}

export function* load(link) {
  return decode(yield storage.get(link.toHex()));
}

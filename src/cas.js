import { Link } from "./link";
import { encode, decode } from "./msgpack";
import { idbKeyval as storage } from "./idb-keyval";
import { sha1 } from "./sha1";

function digest(buf) {
  return new Link(sha1(buf));
}

export function* save(value) {
  let buf = encode(value);
  let link = digest(buf);
  yield storage.set(link.toHex(), buf);
  return link;
}

export function* load(link) {
  let hex = typeof link === "string" ?
    link : link.toHex();
  return decode(yield storage.get(hex));
}

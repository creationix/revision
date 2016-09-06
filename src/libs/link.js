import { sha1 } from "./sha1";
import {
  frameCommit, deframeCommit,
  frameTree, deframeTree,
  frameBlob, deframeBlob
} from "./git-codec";

// Consumers of this API must provide the following interface here.
// function get(hash) -> promise<value>
// function set(hash, value) -> promise
export let storage = {};

export function* saveBlob(value) {
  let buf = frameBlob(value);
  let hex = sha1(buf);
  yield storage.set(hex, buf);
  return hex;
}

export function* saveTree(value) {
  let buf = frameTree(value);
  let hex = sha1(buf);
  yield storage.set(hex, buf);
  return hex;
}

export function* saveCommit(value) {
  let buf = frameCommit(value);
  let hex = sha1(buf);
  yield storage.set(hex, buf);
  return hex;
}

export function* loadBlob(hex) {
  return deframeBlob(yield storage.get(hex));
}

export function* loadTree(hex) {
  return deframeTree(yield storage.get(hex));
}

export function* loadCommit(hex) {
  return deframeCommit(yield storage.get(hex));
}

export function* exists(hex) {
  return yield storage.has(hex);
}

// Look for links in an object
export function scanTree(tree) {
  return tree.map(entry => entry.hash);
}

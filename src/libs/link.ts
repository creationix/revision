import { sha1 } from "./sha1"
import {
  frameCommit, deframeCommit,
  frameTree, deframeTree,
  frameBlob, deframeBlob
} from "./git-codec"


interface Storage {
  get?: (hash : string) => Promise<Uint8Array>,
  set?: (hash : string, value: Uint8Array) => Promise<void>,
  has?: (hash : string) => Promise<boolean>,
  clear?: () => Promise<void>
}
// Consumers of this API must provide the following interface here.
// function get(hash) -> promise<value>
// function set(hash, value) -> promise
export let storage : Storage  = {} as Storage

export async function saveBlob(value: GitBlob) {
  let buf = frameBlob(value);
  let hex = sha1(buf);
  await storage.set(hex, buf);
  return hex;
}

export async function saveTree(value: GitTree) {
  let buf = frameTree(value);
  let hex = sha1(buf);
  await storage.set(hex, buf);
  return hex;
}

export async function saveCommit(value: GitCommit) {
  let buf = frameCommit(value);
  let hex = sha1(buf);
  await storage.set(hex, buf);
  return hex;
}

export async function loadBlob(hex: string) {
  return deframeBlob(await storage.get(hex));
}

export async function loadTree(hex: string) {
  return deframeTree(await storage.get(hex));
}

export async function loadCommit(hex: string) {
  return deframeCommit(await storage.get(hex));
}

export async function exists(hex: string): Promise<boolean> {
  return storage.has(hex);
}

// Look for links in an object
export function scanTree(tree) {
  return tree.map(entry => entry.hash);
}

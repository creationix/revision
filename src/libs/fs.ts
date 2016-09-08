import { loadBlob } from "./link"
import { newIdbKeyval } from "./idb-keyval"
import { frameBlob } from "./git-codec"
import { sha1 } from "./sha1"

let fs = newIdbKeyval('filesystem');

export async function loadFile(entry) {
  if (entry.dirty) return await fs.get(entry.path);
  else return await loadBlob(entry.hash);
}

export async function saveFile(entry, value) {
  let hash = sha1(frameBlob(value));
  if (hash === entry.dirty) return;
  if (hash === entry.hash) {
    entry.dirty = false;
  }
  else {
    entry.dirty = hash;
    await fs.set(entry.path, value);
  }
}

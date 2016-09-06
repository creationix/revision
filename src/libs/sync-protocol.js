import { storage, scan } from "./link"
import { decode } from "./msgpack"
import { run } from "./async"
import { sha1 } from "./sha1"

function empty(obj) {
  for (let key in obj) return !key;
  return true;
}

export function* serve(read, write) {
  let message;
  while ((message = yield read())) {
    if (typeof message === "string") {
      let match = message.match(/^(.):([0-9a-f]{40})$/);
      if (!match) {
        throw new Error("Received error on socket: " + message);
      }
      let command = match[1],
          hash = match[2];
      if (command === "s") {
        let root = hash;
        yield* receive(root, read, write);
        yield write("d:" + root);
        continue;
      }
      if (command === "w") {
        run(process(hash, write)).catch(console.error);
        continue;
      }
    }
    throw new Error("Unexpected Message: " + message);
  }
}

// The goal of this function is to download a hash and all it's children
// recursively, but only download objects that aren't found locally. `read()` is
// a generator function that returns buffers or strings. `write(value)` accepts
// buffers or strings.  The read/write pair represents some sort of network
// socket, usually over websockets. `onUpdate(delta)` is an optional parameter
// to get update notifications for powering progress bars.  The local `storage`
// is imported from the environment.
export function* receive(rootHash, read, write, onUpdate) {

  // Map of hashes we've already seen to avoid sending duplicate requests.
  let seen = {};
  // Map of pending wants that we're waiting for.
  let wants = {};
  // Queue of hashes to process
  let queue = [rootHash];

  // Record of hashes that were reported missing or omitted.
  let missing = [];

  /*eslint-disable no-constant-condition*/
  while (true) {
    // Process the hash queue.
    while (queue.length) {
      let hash = queue.pop();

      // Make sure that hash is only processed once.
      if (seen[hash]) continue;
      seen[hash] = true;

      // If we already have the hash locally, load it and scan for child hashes.
      let bin = yield storage.get(hash)
      if (bin) {
        let obj = decode(bin);
        enqueue(obj);
        continue;
      }

      // Send a request for this value.
      wants[hash] = true;
      if (onUpdate) onUpdate(1);
      yield write("w:" + hash);
    }

    if (empty(wants)) break;

    let message = yield read();
    if (!message) throw new Error("Connection closed while waiting for hashes");

    if (typeof message === "string") {
      let match = message.match(/^(.):([0-9a-f]{40})$/);
      if (!match) {
        throw new Error("Received error on socket: " + message);
      }
      let command = match[1],
          hash = match[2];
      if (command === "m" && wants[hash]) {
        if (onUpdate) onUpdate(-1);
        delete wants[hash];
        missing.push(hash);
        continue;
      }
      yield write("Unexpected Message: " + message);
      yield write();
      continue;
    }

    // Make sure it's only handled once.
    let hash = sha1(message);

    // Report if it wasn't wanted
    if (!wants[hash]) {
      yield write("Unwanted blob: " + hash);
      continue;
    }

    // Try to decode the message
    let obj = decode(message);
    // And queue up any child hashes
    enqueue(obj);

    // Save the blob.
    yield storage.set(hash, message);


    // Mark as imported
    if (onUpdate) onUpdate(-1);
    delete wants[hash];
  }

  return missing;

  function enqueue(obj) {
    for (let link of scan(obj)) {
      queue.push(link.toHex());
    }
  }

}

export function* send(rootHash, read, write, onUpdate) {
  yield write("s:" + rootHash);
  let missing = [];

  /*eslint-disable no-constant-condition*/
  while (true) {

    let message = yield read();
    if (!message) throw new Error("Connection closed while waiting for done");

    if (typeof message === "string") {
      let match = message.match(/^(.):([0-9a-f]{40})$/);
      if (!match) {
        throw new Error("Received error on socket: " + message);
      }
      let command = match[1],
          hash = match[2];
      if (command === "w") {
        yield* process(hash, write, missing, onUpdate);
        continue;
      }
      if (command === "d" && hash === rootHash) {
        break;
      }
    }
    throw new Error("Unexpected Message: " + message);
  }

  return missing;
}

function* process(hash, write, missing, onUpdate) {
  if (yield storage.has(hash)) {
    if (onUpdate) onUpdate(1);
    let bin = yield storage.get(hash);
    yield write(bin);
    if (onUpdate) onUpdate(-1);
  }
  else {
    if (missing) missing.push(hash);
    yield write("m:" + hash);
  }
}

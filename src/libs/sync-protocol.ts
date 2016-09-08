import { storage, scanTree } from "./link"
import { deframePlain, decodeTree } from "./git-codec"
import { sha1 } from "./sha1"

interface Read {
  (): Promise<Uint8Array | string | void>
}
interface Write {
  (data?: Uint8Array | string): void
}
interface Update {
  (delta: number): void
}

function empty(obj) {
  for (let key in obj) return !key;
  return true;
}

export async function serve(read: Read, write: Write) {
  let message;
  let inspect = require('util').inspect
  while ((message = await read())) {
    if (typeof message === "string") {
      let match = message.match(/^(.):([0-9a-f]{40})$/);
      if (!match) {
        throw new Error("Received error on socket: " + message);
      }
      let command = match[1],
          hash = match[2];
      if (command === "s") {
        let root = hash;
        await receive(root, read, write);
        await write("d:" + root);
        continue;
      }
      if (command === "w") {
        process(hash, write).catch(console.error);
        continue;
      }
    }
    console.error("Unexpected Message: " + inspect(message));
  }
}

function decode(bin: Uint8Array): GitTree | Uint8Array {
  let [type, data] = deframePlain(bin);
  return (type === "tree") ? decodeTree(data) : data
}

// The goal of this function is to download a hash and all it's children
// recursively, but only download objects that aren't found locally. `read()` is
// a generator function that returns buffers or strings. `write(value)` accepts
// buffers or strings.  The read/write pair represents some sort of network
// socket, usually over websockets. `onUpdate(delta)` is an optional parameter
// to get update notifications for powering progress bars.  The local `storage`
// is imported from the environment.
export async function receive(rootHash: string, read: Read, write: Write, onUpdate?: Update) : Promise<string[]> {

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
      let bin = await storage.get(hash)
      if (bin) {
        enqueue(decode(bin));
        continue;
      }

      // Send a request for this value.
      wants[hash] = true;
      if (onUpdate) onUpdate(1);
      await write("w:" + hash);
    }

    if (empty(wants)) break;

    let message = await read();
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
      await write("Unexpected Message: " + message);
      await write();
      continue;
    }

    // Make sure it's only handled once.
    let hash = sha1(message);

    // Report if it wasn't wanted
    if (!wants[hash]) {
      await write("Unwanted blob: " + hash);
      continue;
    }

    // Try to decode the message
    // And queue up any child hashes
    enqueue(decode(message));

    // Save the blob.
    await storage.set(hash, message);


    // Mark as imported
    if (onUpdate) onUpdate(-1);
    delete wants[hash];
  }

  return missing;

  function enqueue(obj) {
    if (!Array.isArray(obj)) return;
    queue.push.apply(queue, scanTree(obj));
  }

}

export async function send(rootHash: string, read: Read, write: Write, onUpdate?: Update) : Promise<string[]> {
  await write("s:" + rootHash);
  let missing = [];

  /*eslint-disable no-constant-condition*/
  while (true) {

    let message = await read();
    if (!message) throw new Error("Connection closed while waiting for done");

    if (typeof message === "string") {
      let match = message.match(/^(.):([0-9a-f]{40})$/);
      if (!match) {
        throw new Error("Received error on socket: " + message);
      }
      let command = match[1],
          hash = match[2];
      if (command === "w") {
        await process(hash, write, missing, onUpdate);
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

async function process(hash: string, write: Write, missing?: string[], onUpdate?: Update) {
  if (await storage.has(hash)) {
    if (onUpdate) onUpdate(1);
    let bin = await storage.get(hash);
    await write(bin);
    if (onUpdate) onUpdate(-1);
  }
  else {
    if (missing) missing.push(hash);
    await write("m:" + hash);
  }
}

/*global Buffer*/
import { flatten } from "./bintools";

interface Decoder {
  (Uint8Array): any[]|void
}

interface Read {
  () : Promise<any>
  concat: () => any
  updateDecode: (newDecode: Decoder) => void
}

interface Encoder {
  (any): Uint8Array
}

interface Write {
  (any) : Promise<void>
  updateEncode: (newEncode: Encoder) => void
}


export function makeRead(socket, decode) : Read {

  // If writer > reader, there is data to be read.
  // if reader > writer, there is data required.
  let queue = [];
  let reader = 0, writer = 0;

  // null = not started, true = flowing, false = paused
  let state = null;

  // buffer to store leftover data between decoder calls.
  let buffer;

  let concat = decode.concat || defaultConcat;

  let read: Read = function read() {
    // If there is pending data, return it right away.
    if (writer > reader) return queue[reader++];

    // Make sure the data is flowing since we need it.
    if (state === null) {
      state = true;
      // console.log("Starting");
      socket.on('data', onData);
      socket.on('end', onData);
    }
    else if (state === false) {
      state = true;
      // console.log("Resuming");
      socket.resume();
    }

    // Wait for the data or a parse error.
    return new Promise(function (resolve) {
      queue[reader++] = resolve;
    });
  } as Read

  read.updateDecode = (newDecode) => {
    decode = newDecode;
    concat = decode.concat || defaultConcat;
  };

  return read;

  function onData(chunk) {
    // Convert node buffer to portable Uint8Array
    if (chunk) chunk = new Uint8Array(chunk);
    if (!decode) { onValue(chunk); return; }
    buffer = concat(buffer, chunk);
    let out;
    while ((out = decode(buffer))) {
      // console.log("OUT", out);
      buffer = out[1];
      onValue(out[0]);
    }
    // console.log("Done parsing");
  }

  function onValue(value) {
    // console.log("<-", value);
    // If there is a pending writer, give it the data right away.
    if (reader > writer) {
      queue[writer++](value);
      return;
    }

    // Pause the read stream if we're buffering data already.
    if (state && writer > reader) {
      state = false;
      // console.log("Pausing");
      socket.pause();
    }

    queue[writer++] = value;
  }
}

export function makeWrite(socket, encode) {

  let write = function write(value) {
    // console.log("->", value);
    if (encode) value = encode(value);
    return new Promise((resolve, reject) => {
      if (value) socket.write(new Buffer(value), check);
      else socket.end(check);
      function check(err) {
        if (err) return reject(err);
        return resolve();
      }
    });
  } as Write
  write.updateEncode = function (newEncode) {
    encode = newEncode;
  };

  return write;


}

function defaultConcat(buffer, chunk) {
  return (buffer && buffer.length) ? flatten([buffer, chunk]) : chunk;
}

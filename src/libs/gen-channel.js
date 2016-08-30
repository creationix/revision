
export function makeRead(socket, decode) {

  // If writer > reader, there is data to be read.
  // if reader > writer, there is data required.
  let queue = [];
  let reader = 0, writer = 0;

  // null = not started, true = flowing, false = paused
  let state = null;

  // buffer to store leftover data between decoder calls.
  let buffer;

  read.updateDecode = (newDecode) => { decode = newDecode };

  return read;

  function read() {
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
  }

  function onData(chunk) {
    // Convert node buffer to portable Uint8Array
    if (chunk) chunk = new Uint8Array(chunk);
    if (!decode) { onValue(chunk); return; }
    buffer = decode.concat(buffer, chunk);
    let out;
    while ((out = decode(buffer))) {
      // console.log("OUT", out);
      buffer = out[1];
      onValue(out[0]);
    }
    // console.log("Done parsing");
  }

  function onValue(value) {
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

  write.updateEncode = function (newEncode) {
    encode = newEncode;
  };

  return write;

  function write(value) {
    if (encode) value = encode(value);
    if (value) socket.write(Buffer(value));
    else socket.end();
  }
}

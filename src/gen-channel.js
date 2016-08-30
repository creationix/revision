
export function makeRead(socket, decode) {

  // If writer > reader, there is data to be read.
  // if reader > writer, there is data required.
  let queue = [];
  let reader = 0, writer = 0;

  // null = not started, true = flowing, false = paused
  let state = null;

  // buffer to store leftover data between decoder calls.
  let buffer;

  read.updateDecode = newDecode => { decode = newDecode };

  return read;

  function read() {
    // If there is pending data, return it right away.
    if (writer > reader) {
      let evt = queue[reader++];
      if (evt[0]) throw evt[0];
      return evt[1];
    }

    // Make sure the data is flowing since we need it.
    if (state === null) {
      state = true;
      socket.on('data', onRaw);
      socket.on('error', onError);
    }
    else if (state === false) {
      state = true;
      socket.resume();
    }

    // Wait for the data or a parse error.
    return new Promise(function (resolve, reject) {
      queue[reader++] = function (evt) {
        if (evt[0]) return reject(evt[0]);
        return resolve(evt[1]);
      };
    });
  }

  function onError(err) {
    onEvt([err]);
  }

  function onRaw(chunk) {
    chunk = new Uint8Array(chunk);
    console.log("RAW", chunk);
    if (!decode) return onEvt([null,chunk]);
    buffer = buffer ? concat(buffer, chunk) : chunk;
    while (buffer) {
      let value;
      try {
        let parts = decode(buffer);
        if (!parts) return;
        value = parts[0];
        buffer = parts[1];
      }
      catch (err) {
        buffer = null;
        onEvt([err]);
        return;
      }
      onEvt([null,value]);
    }
  }

  function onEvt(evt) {
    // If there is a waiting reader, give it the data it wants.
    if (reader > writer) {
      queue[writer++](evt);
      return;
    }

    // If there is already data in the queue, we should exert backpressure.
    if (writer > reader && state === true) {
      state = false;
      socket.pause();
    }

    // Store the data for a later reader to consume.
    queue[writer++] = evt;
  }

}

function concat(a, b) {
  let out = new Uint8Array(a.length + b.length);
  for (let i = 0, l = a.length; i < l; i++) {
    out[i] = a[i];
  }
  let o = a.length;
  for (let i = 0, l = b.length; i < l; i++) {
    out[o++] = b[i];
  }
  return out;
}

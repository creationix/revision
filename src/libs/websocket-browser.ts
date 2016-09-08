export async function connect(url) {
  let socket = await new Promise((resolve, reject) => {
    let socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    socket.onopen = () => resolve(socket);
    socket.onerror = reject;
  });

  // If writer > reader, there is data to be read.
  // if reader > writer, there is data required.
  let queue = [];
  let reader = 0, writer = 0;

  socket.onmessage = function (evt) {
    let data = evt.data;
    if (data instanceof ArrayBuffer) data = new Uint8Array(data);
    // console.log("<-", data);
    if (reader > writer) {
      queue[writer++](data);
      return;
    }
    queue[writer++] = data;
  }

  return { read, write, socket };

  function read() {
    if (writer > reader) {
      return queue[reader++];
    }
    return new Promise((resolve) => {
      queue[reader++] = resolve;
    });
  }

  function write(value) {
    // console.log("->", value);
    if (value === undefined) socket.close();
    else if (typeof value === "string") socket.send(value);
    else if (value instanceof Uint8Array) socket.send(value.buffer);
    else console.error("Only send strings and Uint8Array buffers");
  }

}

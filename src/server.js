// Make working with Uint8Array less painful in node.js
Uint8Array.prototype.inspect = function () {
  let out = "<Uint8Array";
  for (let i = 0; i < this.length; i++) {
    let b = this[i];
    out += (b < 0x10 ? " 0" : " ") + b.toString(16);
    if (i >= 100) {
      out += "...";
      break;
    }
  }
  out += ">";
  return out;
}

import { run } from "./async";
import { decoder } from "./http-codec";
import { createServer } from "net";
import { makeRead } from "./gen-channel";
// import { encode, decode } from "./msgpack";
// import { load, save } from "./cas-mem";

createServer(function (socket) {
  run(function*() {
    let read = makeRead(socket, decoder());
    let value;
    while ((value = yield read())) {
      console.log("EVENT", value);
    }
    console.log("Done");
    socket.close();
  }());
}).listen(8080);
console.log("Server listening on port 8080");

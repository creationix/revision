import { storage } from "./link";
import { decode } from "./msgpack";
import { run } from "./async";

export function* upload(url, rootHash) {
  let done = {};
  let socket = new WebSocket(url);
  yield new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  console.log("Connected");
  socket.onmessage = function (evt) {
    let message = evt.data;
    if (/^[0-9a-f]{40}$/.test(message)) {
      run(process(message));
    }
  };
  function* process(hash) {
    if (done[hash]) return;
    done[hash] = true;
    console.log("Uploading", hash);
    socket.send(yield storage.get(hash));
  }
  yield* process(rootHash);
}

//
// export function* upload(url, rootHash) {
//   let done = {};
//   return yield* process(rootHash);
//
//   function* process(hash) {
//     if (done[hash]) return;
//     done[hash] = true;
//     console.log("Uploading", hash);
//     if (!hash) return;
//     let body = yield storage.get(hash);
//     let req = new Request(url, {
//       method: "POST",
//       redirect: "manual",
//       body: body
//     });
//     let res = yield fetch(req);
//     let buf = yield res.arrayBuffer();
//     let result = decode(new Uint8Array(buf));
//
//     // for (let i = 1, l = result.length; i < l; i++) {
//     //   yield* process(result[i].toHex());
//     // }
//
//     return result[0];
//   }
// }

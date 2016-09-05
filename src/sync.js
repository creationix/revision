import { storage } from "./libs/link";
import { route } from "./libs/router";
import { h } from "./libs/maquette"
import { go, restore } from "./libs/router"
import { page } from "./components/page"
import { ProgressBar } from "./components/progress-bar"
import { decode } from "./libs/msgpack";
import { run } from "./libs/async";

route("upload/:name", function exportProject(params) {
  let name = params.name;
  document.title = `Uploading ${name} - Revision Studio`;
  let url = (""+document.location.origin + "/").replace(/^http/, 'ws');
  let hash = localStorage.getItem(name);
  let value = 0,
      max = 0;

  let progress = ProgressBar(`Uploading ${name}`);
  var worker = new Worker("upload-worker.js");
  worker.postMessage({ url, hash });
  worker.onmessage = function (evt) {
    if (evt.data === 1) progress.update(value, ++max);
    else if (evt.data === -1) progress.update(++value, max);
    else onDone(evt.data);
  };

  return progress.render;

  function onDone(entry) {
    console.log("DONE!", entry);
    // let name = `${owner}-${repo}`;
    // let hex = binToHex(entry[1].hash);
    // let x, i = 0, base = name;
    // while ((x = localStorage.getItem(name)) && hex !== x) {
    //   name = `${base}-${++i}`;
    // }
    // localStorage.setItem(name, hex);
    // go(`edit/${name}`);
  }
});

route("import/:name/:hash", function importProject(params) {
  if (localStorage.getItem(params.name)) {
    throw new Error("Name already taken: " + params.name);
  }
});


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
// //
// // export function* upload(url, rootHash) {
// //   let done = {};
// //   return yield* process(rootHash);
// //
// //   function* process(hash) {
// //     if (done[hash]) return;
// //     done[hash] = true;
// //     console.log("Uploading", hash);
// //     if (!hash) return;
// //     let body = yield storage.get(hash);
// //     let req = new Request(url, {
// //       method: "POST",
// //       redirect: "manual",
// //       body: body
// //     });
// //     let res = yield fetch(req);
// //     let buf = yield res.arrayBuffer();
// //     let result = decode(new Uint8Array(buf));
// //
// //     // for (let i = 1, l = result.length; i < l; i++) {
// //     //   yield* process(result[i].toHex());
// //     // }
// //
// //     return result[0];
// //   }
// // }

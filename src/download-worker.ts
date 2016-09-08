/// <reference path="typings/lib.webworker.d.ts"/>
import "./libs/cas-idb"
import { connect } from "./libs/websocket-browser"
import { receive } from "./libs/sync-protocol"

onmessage = function(evt) {
  download(evt.data.url, evt.data.hash)
    .then(postMessage)
    .catch(err => {
      throw err;
    });
};

async function download(url, rootHash) {
  let ws;
  let missing = await receive(rootHash, read, write, postMessage);
  return missing;
  async function read() {
    return ws.read()
  }
  async function write(data) {
    ws = ws || await connect(url);
    return ws.write(data)
  }
}

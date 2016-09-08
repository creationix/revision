/// <reference path="typings/lib.webworker.d.ts"/>
import "./libs/cas-idb"
import { connect } from "./libs/websocket-browser"
import { send } from "./libs/sync-protocol"

onmessage = function(evt) {
  upload(evt.data.url, evt.data.hash)
    .then(postMessage)
    .catch(err => {
      throw err;
    });
};

async function upload(url, rootHash) {
  let ws = await connect(url);
  let missing = await send(rootHash, ws.read, ws.write, postMessage);
  return missing;
}

import "./libs/cas-idb"
import { run } from "./libs/async"
import { connect } from "./libs/websocket-browser"
import { send } from "./libs/sync-protocol"

self.onmessage = function(evt) {
  run(upload(evt.data.url, evt.data.hash))
    .then(self.postMessage)
    .catch(err => {
      throw err;
    });
};

function* upload(url, rootHash) {
  let ws = yield* connect(url);
  let missing = yield* send(rootHash, ws.read, ws.write, postMessage);
  return missing;
}

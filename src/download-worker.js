import "./libs/cas-idb"
import { run } from "./libs/async"
import { connect } from "./libs/websocket-browser"
import { receive } from "./libs/sync-protocol"

self.onmessage = function(evt) {
  run(download(evt.data.url, evt.data.hash))
    .then(self.postMessage)
    .catch(err => {
      throw err;
    });
};

function* download(url, rootHash) {
  let ws = yield* connect(url);
  let missing = yield* receive(rootHash, ws.read, ws.write, postMessage);
  return missing;
}

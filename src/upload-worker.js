import "./libs/cas-idb"
import { storage } from "./libs/link"
import { run } from "./libs/async"

self.onmessage = function(evt) {
  wsConnect(evt.data.url).then(socket => {
    return upload(socket, evt.data.hash);
  })
    .then(self.postMessage)
    .catch(self.postMessage);
};

function wsConnect(url) {
  return new Promise((resolve, reject) => {
    let socket = new WebSocket(url);
    socket.onopen = () => resolve(socket);
    socket.onerror = reject;
  });
}

function upload(socket, rootHash) {
  return new Promise((resolve, reject) => {
    let done = {};
    let queue = [];
    socket.send("s:" + rootHash);

    socket.onmessage = evt => {
      let match = evt.data.match(/^(.):([0-9a-f]{40})$/);
      if (match) {
        let command = match[1],
            hash = match[2];
        if (command === 'w') {
          self.postMessage(1);
          queue.push(hash);
          run(process());
          return;
        }
        if (command === 'd' && hash === rootHash) {
          resolve();
          return;
        }
      }
      console.error("Unexpected message from server: " + evt.data);
    };
    socket.onerror = () => {
      reject(new Error("Problem in websocket connection with server"));
    }

    let working;

    function* process() {
      if (working) return;
      working = true;
      while (queue.length) {
        let hash = queue.pop();
        self.postMessage(-1);
        if (done[hash]) continue;
        let bin = yield storage.get(hash);
        socket.send(bin);
        done[hash] = true;
      }
      working = false;
    }

  });
}

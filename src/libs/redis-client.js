import { connect as netConnect } from "net"
import { encode, decode } from "./redis-codec"
import { makeRead, makeWrite } from "./gen-channel"

// Usage:
//   let call = yield connect({ port: 6379});
//   console.log(yield* call("get", "name"));
//   yield* call();
export function connect(options) {
  let read, write, socket;
  return new Promise((resolve, reject) => {
    socket = call.socket = netConnect(options, err => {
      if (err) return reject(err);
      read = call.read = makeRead(socket, decode);
      write = call.write = makeWrite(socket, encode);
      return resolve(call);
    });
  });
  function* call(...args) {
    if (!args.length) return yield write();
    yield write([...args]);
    return yield read();
  }
}


export function makePool(options, maxConnections) {
  options = options || { port: 6379 };
  maxConnections |= 0;
  let pool = [];
  return { call, close };

  function *call(...args) {
    let client;
    if (pool.length) client = pool.pop();
    else client = yield connect(options);
    let result = yield* client(...args);
    if (pool.length < maxConnections) pool.push(client);
    else yield* client();
    return result;
  }

  function* close() {
    maxConnections = 0;
    for (let client of pool) {
      yield* client();
    }
  }
}

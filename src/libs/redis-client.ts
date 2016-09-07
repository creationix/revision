/// <reference path="node.d.ts"/>
import { connect as netConnect } from "net"
import { encode, decode } from "./redis-codec"
import { makeRead, makeWrite } from "./gen-channel"

interface RedisSocket {
  call: (...string) => Promise<any>,
  read: () => Promise<any>
  write: (any) => Promise<void>
  socket: any
}
// Usage:
//   let call = yield connect({ port: 6379});
//   console.log(yield* call("get", "name"));
//   yield* call();
export function connect(options) : Promise<RedisSocket> {
  let read, write, socket;
  return new Promise((resolve, reject) => {
    socket = netConnect(options, err => {
      if (err) return reject(err);
      read = makeRead(socket, decode);
      write = makeWrite(socket, encode);
      return resolve({call,read,write,socket});
    });
  });
  async function call(...args) {
    if (!args.length) return await write();
    await write([...args]);
    return await read();
  }
}


export function makePool(options, maxConnections) {
  options = options || { port: 6379 };
  maxConnections |= 0;
  let pool = [];
  return { call, close };

  async function call(...args) {
    let client;
    if (pool.length) client = pool.pop();
    else client = await connect(options);
    let result = await client(...args);
    if (pool.length < maxConnections) pool.push(client);
    else await client();
    return result;
  }

  async function close() {
    maxConnections = 0;
    for (let client of pool) {
      await client();
    }
  }
}

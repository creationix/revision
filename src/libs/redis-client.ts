/// <reference path="../typings/node.d.ts"/>
import { connect as netConnect } from "net"
import { encode, decode } from "./redis-codec"
import { makeRead, makeWrite } from "./gen-channel"

interface RedisSocket {
  (...string): Promise<any>,
  read: () => Promise<any>
  write: (any) => Promise<void>
  socket: any
}
// Usage:
//   let call = await connect({ port: 6379});
//   console.log(await call("get", "name"));
//   await call();
export function connect(options) : Promise<RedisSocket> {
  let read, write, socket;
  async function call(...args) {
    if (!args.length) return await write();
    await write([...args]);
    return await read();
  }
  return new Promise((resolve, reject) => {
    socket = netConnect(options, err => {
      if (err) return reject(err);
      let client = call as RedisSocket
      read = client.read = makeRead(socket, decode);
      write = client.write = makeWrite(socket, encode);
      client.socket = socket
      return resolve(client);
    });
  });
}


export function makePool(options, maxConnections) {
  options = options || { port: 6379 };
  maxConnections |= 0;
  let pool = [];
  return { call, close };

  async function call(...args) {
    let client: RedisSocket
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

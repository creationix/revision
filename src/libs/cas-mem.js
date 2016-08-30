import { Link, load, save, storage } from "./link";
export { Link, load, save }

let db = {};

storage.get = hash => db[hash];
storage.set = (hash, value) => { db[hash] = value; };

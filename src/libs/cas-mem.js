import { Link, load, save, exists, storage } from "./link";
export { Link, load, save, exists, storage }

let db = {};

storage.get = hash => db[hash];
storage.set = (hash, value) => { db[hash] = value; };
storage.has = (hash) => db.hasOwnProperty(hash);
storage.clear = () => { db = {}; };

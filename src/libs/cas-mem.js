import { storage } from "./link";

let db = {};

storage.get = hash => db[hash];
storage.set = (hash, value) => { db[hash] = value; };
storage.has = (hash) => db.hasOwnProperty(hash);
storage.clear = () => { db = {}; };

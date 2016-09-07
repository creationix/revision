import { storage } from "./link";
import { newIdbKeyval } from "./idb-keyval";

let idbKeyval = newIdbKeyval('hashes');

// Hook up link's storage to use idbKeyval
storage.get = idbKeyval.get;
storage.set = idbKeyval.set;
storage.has = hash => idbKeyval.get(hash).then(value => !!value);
storage.clear = idbKeyval.clear;

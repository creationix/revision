import { storage } from "./link";
import { idbKeyval } from "./idb-keyval";

// Hook up link's storage to use idbKeyval
storage.get = idbKeyval.get;
storage.set = idbKeyval.set;
storage.has = hash => !!idbKeyval.get(hash);
storage.clear = idbKeyval.clear;

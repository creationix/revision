import { Link, load, save, exists, storage } from "./link";
export { Link, load, save, exists, storage }
import { idbKeyval  } from "./idb-keyval";

// Hook up link's storage to use idbKeyval
storage.get = idbKeyval.get;
storage.set = idbKeyval.set;
storage.has = idbKeyval.has;
storage.clear = idbKeyval.clear;

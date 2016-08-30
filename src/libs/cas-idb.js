import { Link, load, save, storage } from "./link";
import { idbKeyval  } from "./idb-keyval";
export { Link, load, save, storage }

// Hook up link's storage to use idbKeyval
storage.get = idbKeyval.get;
storage.set = idbKeyval.set;
storage.clear = idbKeyval.clear;

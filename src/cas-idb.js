import { Link, load, save, storage } from "./link";
import { idbKeyval  } from "./idb-keyval";
export { Link, load, save }

// Hook up link's storage to use idbKeyval
storage.get = idbKeyval.get;
storage.set = idbKeyval.set;

// Expose storage to browser for repl testing
window.storage = storage;

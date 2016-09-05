import { storage } from "./link";
import { makePool } from "./redis-client";
import { run } from "./async";

// Create a connection pool to redis
let pool = makePool(null, 10);

storage.get = hash => run(pool.call("get", hash));
storage.set = (hash, value) => run(pool.call("set", hash, value));
storage.has = (hash) => run(pool.call("exists", hash));
storage.clear = () => run(pool.call("flushdb"));

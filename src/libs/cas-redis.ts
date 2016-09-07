import { storage } from "./link"
import { makePool } from "./redis-client"

// Create a connection pool to redis
let pool = makePool(null, 10)

storage.get = hash => pool.call("get", hash)
storage.set = (hash, value) => pool.call("set", hash, value)
storage.has = (hash) => pool.call("exists", hash)
storage.clear = () => pool.call("flushdb")

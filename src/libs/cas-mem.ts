import { storage } from "./link"

let db = {}

storage.get = async function(hash) { return db[hash] }
storage.set = async function(hash, value) { db[hash] = value }
storage.has = async function(hash) { return db.hasOwnProperty(hash) }
storage.clear = async function() { db = {} }

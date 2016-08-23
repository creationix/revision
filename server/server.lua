local p = require('pretty-print').prettyPrint
local redisConnect = require('redis-client')
require('weblit-websocket')
require('weblit-app')
.bind {
  port=1337,
  host="127.0.0.1"
}
.use(require('weblit-static')("../www"))
.websocket({
  protocol="cas-sync"
}, function (req, read, write)
  local send = redisConnect { host = "localhost", port = 6379 }
  for chunk in read do
    p(chunk)
    write(chunk)
  end
  write()
end)

.start()

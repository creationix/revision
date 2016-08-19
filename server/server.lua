require('weblit-websocket')
require('weblit-app')
.bind {
  port=1337,
  host="127.0.0.1"
}
.websocket({
  protocol="cas-sync"
}, function (req, read, write)
  for chunk in read do
    write(chunk)
  end
  write()
end)

.start()

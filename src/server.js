import { load, save, exists, storage } from "./libs/cas-mem";
import { scan } from "./libs/link";
import { Server, autoHeaders, logger, files, websocket } from "./libs/weblit";
import { encode, decode } from "./libs/msgpack";

new Server()
  .use(logger)      // To log requests to stdout
  .use(autoHeaders) // To ensure we send proper HTTP headers

  // Implement sync protocol over websockets
  .use(websocket(function* (req, read, write) {
    let message;
    while ((message = yield read())) {
      // Download request
      if (message.opcode === 1 && /^[0-9a-f]{40}$/.test(message.payload)) {
        let bin = yield storage.get(message.payload);
        yield write(bin ? bin : "Missing: " + message.payload);
        continue;
      }
      // Upload request
      if (message.opcode === 2) {
        let obj = decode(message.payload);
        let link = yield* save(obj);
        for (let link of scan(obj)) {
          if (yield* exists(link)) continue;
          yield write(link.toHex());
        }
        write("Got: " + link.toHex());
      }
    }
  }))

  // Serve objects over GET requests
  .route({ method: "GET", path: "/:hash"}, function* (req, res, next) {
    let hash = req.params.hash;
    if (!/^[0-9a-f]{40}$/.test(hash)) return yield* next();
    let obj = yield* load(hash);
    res.code = 200;
    res.headers.set("Content-Type", "application/x-msgpack");
    res.body = encode(obj);
  })

  // Handle object uploads over POST
  .route({ method: "POST", path: "/"}, function* (req, res) {
    let obj = decode(req.body);
    let link = yield* save(obj);
    let response = [link];
    for (let link of scan(obj)) {
      if (!(yield* exists(link))) {
        response.push(link)
      }
    }
    res.code = 200;
    res.headers.set("Content-Type", "application/x-msgpack");
    res.headers.set("Location", `/${link.toHex()}`);
    res.body = encode(response);
  })

  .use(files("www"))  // To serve up the client-side app

  .start();

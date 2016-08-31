import { load, save } from "./libs/cas-mem";
import { Server, autoHeaders, logger, files } from "./libs/weblit";

new Server()
  .use(logger)      // To log requests to stdout
  .use(autoHeaders) // To ensure we send proper HTTP headers
  .use(files("."))  // To serve up the client-side app

  // Serve objects over GET requests
  .route({ method: "GET", path: "/:hash"}, function* (req, res, next) {
    let hash = req.params.hash;
    if (!/^[0-9a-f]{40}$/.test(hash)) return yield* next();
    res.code = 200;
    res.headers.set("Content-Type", "application/octet-stream");
    res.body = yield* load(hash);
  })

  // Handle object uploads over POST
  .route({ method: "POST", path: "/"}, function* (req, res) {
    let link = yield* save(req.body);
    res.code = 200;
    res.headers.set("Content-Type", "application/octet-stream");
    res.headers.set("Location", `/${link.toHex()}`);
    res.body = link.toBin();
  })

  .start();


import { Server, autoHeaders, logger, files } from "./libs/weblit";

new Server()
  .use(logger)      // To log requests to stdout
  .use(autoHeaders) // To ensure we send proper HTTP headers
  .use(files("."))  // To serve up the client-side app
  .route({          // To handle logic
    path: "/:name",
    method: "GET",
    host: "*"
  }, function* (req, res) {
    res.code = 200;
    res.body = `Hi ${req.params.name}!`;
  })
  .start();

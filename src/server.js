/*global process*/
import { load, save, exists, storage } from "./libs/cas-mem";
import { scan } from "./libs/link";
import { Server, autoHeaders, logger, files, websocket, request } from "./libs/weblit";
import { encode, decode } from "./libs/msgpack";
import { binToStr } from "./libs/bintools";

// These default to the settings for the Localhost version, production
// deployments will need to provide their own ID and SECRET via the environment.
let GITHUB_CLIENT_ID =
  process.env.GITHUB_CLIENT_ID || "19cf55bb33c6ffbf80c4";
let GITHUB_CLIENT_SECRET =
  process.env.GITHUB_CLIENT_SECRET || "b663a529316de2b0f3218e362bfabab3aaa7890e";


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

  // Send github client id to browser so it knows which app to auth against.
  .route({ method: "GET", path: "/github-client-id"}, function* (req, res) {
    res.code = 200;
    res.body = GITHUB_CLIENT_ID;
  })

  .route({ method: "GET", path: "/github-callback"}, function* (req, res) {
    let url = "https://github.com/login/oauth/access_token";
    let body = yield request("POST", url, {
      "Accept": "application/json",
      "Content-Type": "application/json"
    }, JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: req.query.code,
      state: req.query.state
    }));
    let result = JSON.parse(binToStr(body));
    if (result.error) {
      res.code = 401
      res.body = `Error: ${result.error}\nDescription: ${result.error_description}\nUri: ${result.error_uri}\n`;
      return;
    }
    console.log(result);
    res.code = 302;
    res.headers.set("Set-Cookie", `github_access_token=${result.access_token}`);
    res.headers.set("Location", "/");
    res.body = "Authorized!\n";
  })

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

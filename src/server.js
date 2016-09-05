/*global process*/
import { addInspect } from "./libs/bintools"; addInspect();
import { scan, load, save, exists, storage } from "./libs/link";
import { Server, autoHeaders, logger, files, websocket, request } from "./libs/weblit";
import { encode, decode } from "./libs/msgpack";
import { binToStr } from "./libs/bintools";

import "./libs/cas-redis";

// These default to the settings for the Localhost version, production
// deployments will need to provide their own ID and SECRET via the environment.
let GITHUB_CLIENT_ID =
  process.env.GITHUB_CLIENT_ID || "19cf55bb33c6ffbf80c4";
let GITHUB_CLIENT_SECRET =
  process.env.GITHUB_CLIENT_SECRET || "b663a529316de2b0f3218e362bfabab3aaa7890e";

new Server()
  .use(logger)      // To log requests to stdout
  .use(autoHeaders) // To ensure we send proper HTTP headers


  .use(websocket(function* (req, read, write) {
    let message;
    let upload;
    let wants;

    function checkUpload(hash) {
      if (!upload) return;
      delete wants[hash];
      for (let key in wants) { return key; }
      hash = upload;
      upload = undefined;
      wants = undefined;
      write("d:" + hash);
    }

    while ((message = yield read())) {
      // Upload request
      if (message.opcode === 2) {
        let obj = decode(message.payload);
        let hash = (yield* save(obj)).toHex();
        let queue = [obj];
        while (queue.length) {
          obj = queue.pop();
          for (let link of scan(obj)) {
            if (yield* exists(link)) {
              queue.push(yield link.resolve());
            }
            else {
              if (wants) wants[link.toHex()] = true;
              yield write("w:" + link.toHex());
            }
          }
        }
        checkUpload(hash);
      }
      // Command messages
      // s = start upload, w = want, d = done, m = missing, e = error
      if (message.opcode === 1) {
        let match = message.payload.match(/^(.):([0-9a-f]{40})$/);
        if (!match) continue;
        let command = match[1],
            hash = match[2];
        if (command === 's') {
          if (yield storage.has(hash)) {
            // TODO: scan for deep links that are missing
            // We alredy have this hash.
            yield write("d:" + hash);
          }
          else if (upload) {
            // There is an upload already in progress on this socket.
            yield write("e:" + hash);
          }
          else {
            // Start a new upload
            upload = hash;
            wants = {};
            wants[hash] = true;
            yield write("w:" + match[2]);
          }
        }
        else if (command === 'w') {
          let bin = yield storage.get(hash);
          yield write(bin ? bin : ('m:' + hash));
        }
        else if (command === 'm') {
          checkUpload(hash);
        }
      }
    }
  }))

  // When the browser wants to authenticate with github, it only needs to
  // open this page in a new window.
  .route({ method: "GET", path: "/github-oauth"}, function* (req, res) {
    let oauthState = Math.random().toString(36).substr(2);
    res.code = 302;
    res.headers.set("Location", 'https://github.com/login/oauth/authorize' +
      `?client_id=${GITHUB_CLIENT_ID}&state=${oauthState}`);
    res.body = "Redirecting to start github oauth flow...\n";
  })

  // After the user authencates with github and authorizes us, they will be
  // redirected back to this url.  We need to fetch the token and give it to
  // the browser.
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
    res.code = 302;
    res.headers.set("Location", `/#github-token/${result.access_token}`);
    res.body = "Authorized, redirecting back to main site!\n";
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

/// <reference path="typings/node.d.ts"/>
import { addInspect } from "./libs/bintools"; addInspect();
import { Server, autoHeaders, logger, files, websocket, request } from "./libs/weblit";
import { binToStr } from "./libs/bintools";
import { serve } from "./libs/sync-protocol"

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

  // Serve up the sync protocol over websocket
  .use(websocket(async function (req, read, write) {
    await serve(read, write).catch(console.error);
  }))

  // When the browser wants to authenticate with github, it only needs to
  // open this page in a new window.
  .route({ method: "GET", path: "/github/oauth"}, async function (req, res) {
    let oauthState = Math.random().toString(36).substr(2);
    res.code = 302;
    res.headers.set("Location", 'https://github.com/login/oauth/authorize' +
      `?client_id=${GITHUB_CLIENT_ID}&state=${oauthState}`);
    res.body = "Redirecting to start github oauth flow...\n";
  })

  // After the user authencates with github and authorizes us, they will be
  // redirected back to this url.  We need to fetch the token and give it to
  // the browser.
  .route({ method: "GET", path: "/github/callback"}, async function (req, res) {
    let url = "https://github.com/login/oauth/access_token";
    let body = await request("POST", url, {
      "Accept": "application/json",
      "Content-Type": "application/json"
    }, JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: req.query.code,
      state: req.query.state
    })) as Uint8Array;
    let result = JSON.parse(binToStr(body));
    if (result.error) {
      res.code = 401
      res.body = `Error: ${result.error}\nDescription: ${result.error_description}\nUri: ${result.error_uri}\n`;
      return;
    }
    res.code = 302;
    res.headers.set("Location", `/#github/token/${result.access_token}`);
    res.body = "Authorized, redirecting back to main site!\n";
  })

  .use(files("www"))  // To serve up the client-side app

  .start();

import { run } from "./async";
import { readCommit } from "./github";
import { save } from "./cas";
import { idbKeyval as storage } from "./idb-keyval";
window.storage = storage;

run(function*() {
  yield navigator.serviceWorker.register("worker.js");
  let root = yield storage.get("root");
  if (!root) {
    let owner = "creationix";
    let repo = "revision";
    let ref = "heads/master";
    console.log(`Importing github://${owner}/${repo}/refs/${ref}`);
    let commit = yield* readCommit(owner, repo, ref);
    console.log(commit);
    let link = yield* save(commit);
    console.log(link);
    root = link.toHex();
    yield storage.set("root", link.toHex());
  }

  let response = yield fetch(`/${root}/`);
  let body = yield response.text();
  console.log("Response", response.headers, body);
}());

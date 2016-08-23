import { run } from "./async";
import { readCommit } from "./github";
import { save } from "./cas";
import { idbKeyval as storage } from "./idb-keyval";
window.storage = storage;

run(function*() {
  yield navigator.serviceWorker.register("worker.js");
  let owner = "creationix";
  let repo = "revision";
  let ref = "heads/master";
  console.log(`Importing github://${owner}/${repo}/refs/${ref}`);
  let commit = yield* readCommit(owner, repo, ref);
  console.log(commit);
  let link = yield* save(commit);
  console.log(link);
}());

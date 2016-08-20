import { run } from "./async";
import { readCommit } from "./github";

run(function*() {
  let owner = "creationix";
  let repo = "revision";
  let ref = "heads/master";
  console.log(`Importing github://${owner}/${repo}/refs/${ref}`);
  let commit = yield* readCommit(owner, repo, ref);
  console.log(commit);
}());

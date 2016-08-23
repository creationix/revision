import { run } from "./async";
import { readCommit } from "./github";
import { save } from "./cas";

run(function*() {
  let owner = "creationix";
  let repo = "revision";
  let ref = "heads/master";
  console.log(`Importing github://${owner}/${repo}/refs/${ref}`);
  let commit = yield* readCommit(owner, repo, ref);
  console.log(commit);
  let link = yield* save(commit);
  console.log(link);
}());

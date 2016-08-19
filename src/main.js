import { run } from "./async";
import { load } from "./cas";
import { importCommit } from "./github";

run(function*() {
  let owner = "creationix";
  let repo = "revision";
  let ref = "heads/master";
  console.log(`Importing github://${owner}/${repo}/refs/${ref}`);
  let link = yield* importCommit(owner, repo, ref);
  console.log(`Imported as ${link.toHex()}`);
  console.log(yield* load(link));
}());

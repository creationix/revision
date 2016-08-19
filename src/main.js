import { run } from "./async";
import { load } from "./cas";
import { importCommit } from "./github";


run(function*() {
  let link = yield* importCommit(
    "creationix", "msgpack-es", "heads/master"
  );
  console.log(link);
  console.log(yield* load(link));
}());

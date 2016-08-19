import { run } from "./async";
import { load, save } from "./cas"

run(function*() {
  for (let link of yield* load(yield* save([
    yield* save({name:"Tim",age:34}),
    yield* save({name:"Jack",age:10}),
    yield* save(new Uint8Array(20))
  ]))) {
    console.log(yield* link.resolve());
  }
}());

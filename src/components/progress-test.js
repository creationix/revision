import { ProgressBar } from "./progress-bar";
import { ScreenShade } from "./screen-shade";

export function ProgressTest() {
  let total = 0;
  let done = 0;

  let progress = ProgressBar("Importing the world");
  let shade = ScreenShade(progress);

  let it = setInterval(function () {
    if (Math.random() < 0.3 && total < 100) total += Math.floor(Math.random() * 5) + 1;
    if (Math.random() < 0.9 && done < total) done++;
    if (done === total && total > 20) clearInterval(it);
    progress.update(done, total);
  }, 33);

  return shade;
}

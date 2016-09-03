
import { newProgressBar } from "./components/progress-bar";
import { projector, css } from "maquette";

let progress = newProgressBar("Something is going on");

document.addEventListener('DOMContentLoaded', function () {
  projector.append(document.body, progress.render);
  let style = document.createElement("style");
  style.textContent = css.join("\n")
  document.head.appendChild(style);

  let total = 0;
  let done = 0;
  let it = setInterval(function () {
    if (Math.random() < 0.3 && total < 100) total += Math.floor(Math.random() * 5) + 1;
    if (Math.random() < 0.9 && done < total) done++;
    if (done === total && total > 20) clearInterval(it);
    progress.update(done, total);
  }, 50);
});

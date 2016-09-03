
import { newProgressBar } from "./components/progress-bar";
import { css } from "css";
import { projector } from "projector";

let progress = newProgressBar("Something is going on");

document.addEventListener('DOMContentLoaded', function () {
  projector.append(document.body, progress.render);
  let style = document.createElement("style");
  style.textContent = css.join("\n")
  document.head.appendChild(style);

  let total = 0;
  let done = 0;
  let it = setInterval(100, function () {
    if (Math.random() < 0.2) total += Math.floor(Math.random() * 10) + 2;
    if (Math.random() < 0.6 && done < total) done++;
    if (done === total && total > 20) clearInterval(it);
    progress.update(done, total);
  })
});

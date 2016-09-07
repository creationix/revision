import { h, VNode } from "../libs/maquette"
import { projector, style } from "../libs/router"

interface ProgressBar{
  (): VNode
  update: (done: number, total: number) => void
}

export function ProgressBar(message: string) {
  let total = 0,
      done = 0;

  let progress = render as ProgressBar;
  progress.update = update;
  return progress;

  function update(newDone, newTotal) {
    done = newDone;
    total = newTotal;
    projector.scheduleRender();
  }

  function render() {
    let percent = (done && total) ?
      (done * 100 / total) : 0;
    return h("progress-bar", [
      h('div.progress', {styles:{width:`${percent}%`}}),
      h('div.message', [
        `${message} (${done}/${total})`
      ])
    ]);
  }
}

style(`
progress-bar {
  display: block;
  background-color: #665;
  box-shadow: inset 0 0 30px #998;
  text-align: center;
  font-size: 12px;
  height: 3em;
}
progress-bar .progress {
  transition: width 0.33s;
  background-color: #069;
  height: 3em;
  box-shadow: inset 0 0 30px #58f;

}
progress-bar .message {
  height: 3em;
  line-height: 3em;
  margin-top: -3em;
  white-space: nowrap;
  padding: 0 10px;
  color: #eee;
  text-shadow: 0 0 1px #000;
  font-weight: bold;
  font-family: ubuntu, sans-serif;
}
`);

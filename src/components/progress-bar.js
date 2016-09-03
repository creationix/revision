import { h, projector, css } from "maquette"

css.push(`
progress-bar {
  position: absolute;
  display: block;
  width: 100%; height: 100%;
  left: 0; top: 0; right: 0; bottom: 0;
  background-color: rgba(0,0,0,0.3);
}
progress-bar .outer {
  width: 50%;
  margin-left: auto;
  margin-right: auto;
  background-color: #fff;
}
`);

export function newProgressBar(message) {
  let total = 0,
      done = 0;

  return { update, render };

  function update(newDone, newTotal) {
    done = newDone;
    total = newTotal;
    projector.scheduleRender();
  }
  function render() {
    let percent = (done && total) ?
      (done * 100 / total) : 0;
    return h("progress-bar", [
      h('div.outer', [
        h('div.fill', {styles:{width:`${percent}%`}}),
        h('div.overlay', [
          `${message} (${done}/${total})`
        ])
      ])
    ]);
  }
}

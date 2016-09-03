import { h } from "maquette"
import { inject } from "../libs/css"

inject(`
screen-shade {
  position: absolute;
  width: 100%; height: 100%;
  left: 0; top: 0; right: 0; bottom: 0;
  display: flex;
  background-color: rgba(0,0,0,0.5);
}
`);

export function ScreenShade(content) {

  return { render };

  function render() {
    return h("screen-shade", [
      content.render()
    ]);
  }
}

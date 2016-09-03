import { h, style } from "../libs/maquette"

style(`
screen-shade {
  position: absolute;
  width: 100%; height: 100%;
  left: 0; top: 0; right: 0; bottom: 0;
  display: flex;
  background-color: rgba(0,0,0,0.5);
}
screen-shade .wrapper {
  margin: auto;
  box-shadow: 0 0 40px rgba(0,0,0,0.5);
}
`);

export function ScreenShade(content) {

  return { render };

  function render() {
    return h("screen-shade", [
      h("div.wrapper", [
        content.render()
      ])
    ]);
  }
}

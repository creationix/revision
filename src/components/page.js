import { style } from "../libs/style-inject";
import { h } from "../libs/maquette"

style(`
  .content-wrapper {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 15px;
  }
`);

export function page(title, body) {
  return h('div.content-wrapper', [
    h('h1', [].concat(title)),
    h('div.pure-g', {key:title}, [].concat(body))
  ]);
}

import { h } from "../libs/maquette"
import { page } from "./page"

export function notFound() {
  document.title = `Not Found`;

  return page(`Not Found`, h("div.pure-u-1.pure-u-md-1-1", [
    h('a.pure-button.pure-button-primary', {href:"#"}, "Go Home")
  ]));


}

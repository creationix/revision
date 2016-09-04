import { route } from "./libs/router";
import { h } from "./libs/maquette"
import { page } from "./components/page"

import "./github" // Include github import ability.

route("", function () {
  return page("Revison Studio", h("div.pure-u-1-1", [
    h('a.pure-button.pure-button-primary', {href:"#github-import"}, "Import from github")
  ]));
});

route("tree/:hash", function (params) {
  return h("p", [`TODO: Render tree for ${params.hash}`]);
});

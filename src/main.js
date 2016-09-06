import { route } from "./libs/router";
import { h } from "./libs/maquette"
import { page } from "./components/page"
import { TreeView } from "./components/tree-view"
import { SplitView } from "./components/split-view"
import { TextEdit } from "./components/text-edit"

// Use IndexedDB for storage
import "./libs/cas-idb"

// Include github import ability.
import "./github"

// Include server-sync ability
import "./sync"

route("", function () {
  document.title = `Revision Studio`;

  return page("Revison Studio", h("div.pure-u-1.pure-u-md-1-1", [
    h('a.pure-button.pure-button-primary', {href:"#github-import"}, "Import from github")
  ]));
});

route("edit/:name", function (params) {
  let hash = localStorage.getItem(params.name);
  if (!hash) return false;
  document.title = `${params.name} - Revision Studio`;
  let tree = TreeView(params.name, hash);
  tree.onclick = function (evt, entry) {
    console.log("click", evt, entry);
  }
  tree.oncontextmenu = function (evt, entry) {
    evt.preventDefault();
    console.log("contextmenu", evt, entry);
  }
  let editor = TextEdit();
  let split = SplitView(tree, editor, 200);
  return split;
});

import { page } from "./components/page"
import { route, projector } from "./libs/router";
import { h } from "./libs/maquette"
import { TreeView } from "./components/tree-view"
import { SplitView } from "./components/split-view"
import { TextEdit } from "./components/text-edit"
import { ProgressBar } from "./components/progress-bar"
import { isUTF8 } from "./libs/bintools"

// Use IndexedDB for storage
import "./libs/cas-idb"

// Include github import ability.
import "./github"

let serverUrl = (""+document.location.origin + "/").replace(/^http/, 'ws');

route("", function () {
  document.title = `Revision Studio`;

  return page("Revison Studio", h("div.pure-u-1.pure-u-md-1-1", [
    h('a.pure-button.pure-button-primary', {href:"#github/import"}, "Import from github")
  ]));
});

route(":name/:hash", function (params: {name:string, hash: string}) {
  // Restrict the shape of the hash in the route match.
  if (!/^[0-9a-f]{40}$/.test(params.hash)) return false;

  document.title = `${params.name} - Revision Studio`;

  let progress: ProgressBar,
      split: SplitView,
      editor: TextEdit,
      tree: TreeView;

  download()
  edit()

  return function () {
    return h('revison-studio', progress ? progress() : split());
  }

  function download() {
    progress = ProgressBar(`Syncing Down ${params.hash}`);
    projector.scheduleRender();
    var worker = new Worker("download-worker.js");
    worker.postMessage({ url: serverUrl, hash: params.hash });
    worker.onmessage = function (evt) {
      if (typeof evt.data === 'number') {
        progress.update(evt.data);
      }
      progress = null;
      projector.scheduleRender();
    };
  }

  function upload() {
    progress = ProgressBar(`Syncing Up ${params.hash}`);
    projector.scheduleRender();
    var worker = new Worker("upload-worker.js");
    worker.postMessage({ url: serverUrl, hash: params.hash });
    worker.onmessage = function (evt) {
      if (typeof evt.data === 'number') {
        progress.update(evt.data);
      }
      progress = null;
      projector.scheduleRender();
    };
  }

  function edit() {
    tree = TreeView(params.name, params.hash);
    tree.onclick = onClick
    tree.oncontextmenu = onMenu;
    editor = TextEdit();
    split = SplitView(tree, editor, 200);
    projector.scheduleRender();
  }

  function onClick(evt, entry) {
    if (entry.type === "file") {
      editor.set(entry);
    }
    else {
      console.log("click", evt, entry);
    }
  }
  function onMenu(evt, entry) {
    evt.preventDefault();
    console.log("contextmenu", evt, entry);
  }

});

import { loadCommit, loadTree, loadBlob } from "./libs/link"
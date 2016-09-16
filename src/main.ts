import { page } from "./components/page"
import { route, projector, style } from "./libs/router";
import { h, VNode } from "./libs/maquette"
import { TreeView } from "./components/tree-view"
import { SplitView } from "./components/split-view"
import { TextEdit } from "./components/text-edit"
import { ProgressBar } from "./components/progress-bar"
import { isUTF8 } from "./libs/bintools"
import { aliases } from "./libs/aliases"

// Use IndexedDB for storage
import "./libs/cas-idb"

// Include github import ability.
import "./github"

let serverUrl = (""+document.location.origin + "/").replace(/^http/, 'ws');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
  .then(function(reg) {
    // registration worked
    console.log('Registration succeeded. Scope is ' + reg.scope);
  }).catch(function(error) {
    // registration failed
    console.log('Registration failed with ' + error);
  });
}


route("", function () {
  document.title = `Revision Studio`;
  let keys = [];
  aliases.keys().then(onKeys);

  return function () {
    return page("Revison Studio", h("div.pure-u-1.pure-u-md-1-1", [
      keys.map(key =>
        h('p', {key}, h('a.pure-button', {href:"#" + key}, key))
      ),
      h('p', {key:"github/import"}, h('a.pure-button', {href:"#github/import"}, "Import from github"))
    ]))();
  }

  function onKeys(newKeys) {
    keys = newKeys;
    projector.scheduleRender();
  }
});

route(":name/:hash", function (params: {name:string, hash: string}) {
  // Restrict the shape of the hash in the route match.
  if (!/^[0-9a-f]{40}$/.test(params.hash)) return false;

  document.title = `Importing ${params.name} - Revision Studio`;

  let progress = ProgressBar(`Syncing Down ${params.hash}`);
  let update = progress.update
  projector.scheduleRender();
  var worker = new Worker("download-worker.js");
  worker.postMessage({ url: serverUrl, hash: params.hash });
  worker.onmessage = function (evt) {
    if (typeof evt.data === 'number') {
      update(evt.data);
      return;
    }
    aliases.set(params.name, params.hash).then(() => {
      document.location.hash = params.name;
    })
  };

  return progress;
});

route(":name", function (params: {name:string}) {

  document.title = `Editing ${params.name} - Revision Studio`;

  let progress: ProgressBar,
      split: SplitView,
      editor: TextEdit,
      tree: TreeView,
      sync: VNode;
  let rootHash;


  edit();

  return function () {
    return h('revison-studio', [
      progress && progress(),
      split && split(),
      sync
    ].filter(Boolean));
  }

  function upload() {
    progress = ProgressBar(`Syncing Up ${rootHash}`);
    let update = progress.update
    projector.scheduleRender();
    var worker = new Worker("upload-worker.js");
    worker.postMessage({ url: serverUrl, hash: rootHash });
    worker.onmessage = function (evt) {
      if (typeof evt.data === 'number') {
        update(evt.data);
        return;
      }
      progress = null;
      projector.scheduleRender();
    };
  }

  async function edit() {
    rootHash = await aliases.get(params.name);
    tree = TreeView(params.name, rootHash);
    tree.onclick = onClick
    tree.oncontextmenu = onMenu;
    editor = TextEdit(params.name);
    split = SplitView(tree, editor, 200);
    sync = h("button.sync.pure-button", {onclick:upload}, "Save");
    projector.scheduleRender();
  }

  function onClick(evt: MouseEvent, entry) {
    if (evt.altKey || evt.metaKey || evt.ctrlKey || evt.shiftKey) return;
    if (entry.type === "file") {
      evt.preventDefault();
      editor.set(entry.path, entry.hash);
    }
  }
  function onMenu(evt, entry) {
    // evt.preventDefault();
    console.log("contextmenu", evt, entry);
  }

});

import { loadCommit, loadTree, loadBlob } from "./libs/link"

style(`
button.sync {
  position: absolute;
  right: 5px;
  bottom: 5px;
  opacity: 0.5;
}
button.sync:hover {
  opacity: 1.0;
}
`)

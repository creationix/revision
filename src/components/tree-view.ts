import { h, VNode } from "../libs/maquette"
import { guess } from "../libs/mime";
import { projector, style } from "../libs/router";
import { loadCommit, loadTree } from "../libs/link";
import { commitMode, treeMode, blobMode, execMode, symMode } from "../libs/git-codec"

export interface TreeView {
  (): VNode,
  onclick? : (evt: MouseEvent, entry) => void,
  oncontextmenu? : (evt: PointerEvent, entry) => void,
}
export function TreeView(rootName, rootHash) {
  let root = {
    name: rootName,
    mode: commitMode,
    hash: rootHash
  };
  let data = localStorage.getItem("OPEN_DIRS");
  let openDirs = data ? JSON.parse(data) : {};
  openDirs[rootName] = true;

  let tree = render as TreeView;
  return tree;

  function render() {
    return h('tree-view', { onclick, oncontextmenu }, [
      h('ul', [].concat(renderNode(rootName, root)))
    ]);
  }

  function find(evt) {
    let node = evt.target;
    while (!node.dataset.type) {
      node = node.parentElement
      if (node === document.body) return;
    }
    return node.dataset;
  }

  function onclick(evt: MouseEvent) {
    let data = find(evt);
    if (!data) return;
    if (tree.onclick) {
      tree.onclick(evt, data);
      if (evt.defaultPrevented) return;
    }
    if (data.type === 'tree') {
      openDirs[data.path] = !openDirs[data.path];
      localStorage.setItem("OPEN_DIRS", JSON.stringify(openDirs));
      projector.scheduleRender();
      return;
    }
  }

  function oncontextmenu(evt: PointerEvent) {
    let data = find(evt);
    if (!data) return;
    if (tree.oncontextmenu && tree.oncontextmenu(evt, data)) return;
  }

  function renderNode(path, node) {
    switch(node.mode) {
      case commitMode: return renderTree(path, node, true);
      case treeMode: return renderTree(path, node);
      case blobMode: return renderFile(path, node);
      case execMode: return renderFile(path, node, true);
      case symMode: return renderSym(path, node);
    }
  }

  function renderTree(path: string, value: any, isCommit?: boolean): VNode {
    let children = value.children;
    let entries = [];
    let open = children && openDirs[path];
    if (open) {
      for (let child of children) {
        let subPath = (path ? path + "/" : "") + child.name;
        entries.push(renderNode(subPath, child));
      }
    }
    else if (!children) {
      (async function() {
        let hash = value.hash;
        if (isCommit) {
          value.commit = await loadCommit(hash);
          hash = value.hash = value.commit.tree;
        }
        let tree = await loadTree(hash);
        return tree;
      }()).then(tree => {
        value.children = tree.sort((a,b) => {
          let A = a.mode === treeMode,
              B = b.mode === treeMode;
          return A === B ? a.name.localeCompare(b.name) : A ? -1 : 1;
        });
        projector.scheduleRender();
      });

    }
    return h("li", {key:path}, [
      h('div.row', {
        title: value.hash,
        classes: {
          "icon-down-dir": open,
          "icon-right-dir": !open
        },
        'data-type': 'tree',
        'data-mode': value.mode,
        'data-name': value.name,
        'data-hash': value.hash,
        'data-mime': 'application/x-directory',
        'data-path': path
      }, [
        h('span.icon-folder', [value.name])
      ]),
      h('ul', entries)
    ]);
  }

  function renderFile(path: string, value: any, exec?: boolean): VNode {
    let mime = guess(path);
    let icon = exec ? "icon-cog" : guessIcon(mime);
    return h('li', {key:path}, [
      h('div.row', {
        title: value.hash,
        'data-type': 'file',
        'data-mode': value.mode,
        'data-name': value.name,
        'data-hash': value.hash,
        'data-mime': mime,
        'data-path': path
      }, [
        h('span', { class: icon }, [value.name])
      ])
    ]);
  }

  function renderSym(path: string, value: any): VNode {
    let mime = guess(path);
    return h("li", {key: path}, [
      h("div.row", {
        title: value.hash,
        'data-type': 'link',
        'data-mode': value.mode,
        'data-name': value.name,
        'data-hash': value.hash,
        'data-mime': mime,
        'data-path': path
      }, [
        h('span.icon-link', [value.name])
      ])
    ]);
  }

}

function guessIcon(mime: string): string {
  if (/pdf$/.test(mime)) return "icon-file-pdf";
  if (/^image/.test(mime)) return "icon-file-image";
  if (/^audio/.test(mime)) return "icon-file-audio";
  if (/^video/.test(mime)) return "icon-file-video";
  if (/^zip2?$/.test(mime)) return "icon-file-archive";
  if (/^application.*(javascript|json|xml)$/.test(mime) ||
      /^text.*(src|html|css|lua|script)$/.test(mime)) return "icon-file-code";
  if (/^text/.test(mime)) return "icon-doc-text";
  return "icon-doc";
}

style(`
tree-view {
  overflow-y: auto;
  overflow-x: hidden;
}
tree-view {
  font-size: 12px;
  -webkit-user-select: none;  /* Chrome all / Safari all */
  -moz-user-select: none;     /* Firefox all */
  -ms-user-select: none;      /* IE 10+ */
  user-select: none;          /* Likely future */
  cursor: default;
  padding: 5px 0 5px 0;
}
tree-view ul {
  list-style-type: none;
  margin: 0;
  padding: 0 0 0 17px;
}
tree-view > ul {
  padding-left: 25px;
}
tree-view .row [data-dirty] {
  font-weight: bold;
}
tree-view .row {
  display: block;
  white-space: nowrap;
  line-height: 2em;
  font-size: 1em;
  font-weight: 100;
  font-family: 'Lucida Grande', 'Segoe UI', Ubuntu, Cantarell, sans-serif;
  margin-left: -1000px;
  padding-left: 995px;
  padding-right: 5px;
}
tree-view .row.icon-down-dir,
tree-view .row.icon-right-dir {
  margin-left: -1017px;
}
tree-view .row:hover {
  background-color: rgb(50,50,50);
}
tree-view span[class^="icon-"]::before {
  font-size: 1.2em;
  padding-right: 0.2em;
}
`);

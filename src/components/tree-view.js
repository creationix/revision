import { h } from "../libs/maquette"
import { run } from "../libs/async"
import { Link } from "../libs/link"
import { guess } from "../libs/mime";
import { projector } from "../libs/router";
import { style } from "../libs/style-inject"

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

export function TreeView(rootName, rootHash) {
  let root = [0, new Link(rootHash)];
  let data = localStorage.getItem("OPEN_DIRS");
  let openDirs = data ? JSON.parse(data) : {};
  openDirs[rootName] = true;

  return render;

  function render() {
    return h('tree-view', {onclick,oncontextmenu}, [
      h('ul', [].concat(renderNode(rootName, rootName, root)))
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

  function onclick(evt) {
    let data = find(evt);
    if (!data) return;
    if (render.onclick) {
      render.onclick(evt, data);
      if (evt.defaultPrevented) return;
    }
    if (data.type === 'tree') {
      openDirs[data.path] = !openDirs[data.path];
      localStorage.setItem("OPEN_DIRS", JSON.stringify(openDirs));
      projector.scheduleRender();
      return;
    }
  }

  function oncontextmenu(evt) {
    console.log("CONTEXT", evt);
    let data = find(evt);
    if (!data) return;
    if (render.oncontextmenu && render.oncontextmenu(evt, data)) return;
  }

  function renderNode(path, name, node) {
    let value = node[1];
    switch(node[0]) {
      case 0: return renderTree(path, name, value);
      case 1: return renderFile(path, name, value);
      case 2: return renderFile(path, name, value, true);
      case 3: return renderSym(path, name, value);
    }
  }

  function renderTree(path, name, value) {
    let children = value.children;
    let entries = [];
    let open = children && openDirs[path];
    if (open) {
      let keys = Object.keys(children).sort(function (a, b) {
        var A = children[a][0],
            B = children[b][0];
        return A === B ? a.localeCompare(b) : A ? 1 : -1;
      });
      for (let key of keys) {
        let subPath = (path ? path + "/" : "") + key;
        entries.push(renderNode(subPath, key, children[key]));
      }
    }
    else if (!children) {
      run(value.resolve()).then(tree => {
        value.children = tree;
        projector.scheduleRender();
      });

    }
    return h("li", {key:path}, [
      h('div.row', {
        title: name,
        classes: {
          "icon-down-dir": open,
          "icon-right-dir": !open
        },
        'data-type': 'tree',
        'data-name': name,
        'data-path': path
      }, [
        h('span.icon-folder', [name])
      ]),
      h('ul', entries)
    ]);
  }

  function renderFile(path, name, value, exec) {
    let mime = guess(path);
    let icon = exec ? "icon-cog" : guessIcon(mime);
    return h('li', {key:path}, [
      h('div.row', {
        title: name,
        'data-type': 'file',
        'data-mime': mime,
        'data-name': name,
        'data-path': path
      }, [
        h('span', { class: icon }, [name])
      ])
    ]);
  }

  function renderSym(path, name, value) {
    return h("li", {key: path}, [
      h("div.row", {
        title: value,
        'data-type': 'link',
        'data-target': value,
        'data-name': name,
        'data-path': path
      }, [
        h('span.icon-link', [name])
      ])
    ]);
  }

}

function guessIcon(mime) {
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

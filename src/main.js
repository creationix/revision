import { route, projector, go } from "./libs/router";
import { h } from "./libs/maquette"
import { page } from "./components/page"
import { run } from "./libs/async"
import { Link } from "./libs/link"
import { guess } from "./libs/mime";

// Use IndexedDB for storage
import "./libs/cas-idb"

// Include github import ability.
import "./github"

route("", function () {
  document.title = `Revision Studio`;

  return page("Revison Studio", h("div.pure-u-1.pure-u-md-1-1", [
    h('a.pure-button.pure-button-primary', {href:"#github-import"}, "Import from github")
  ]));
});

route("edit/:name", function (params) {
  let hash = localStorage.getItem(params.name);
  if (!hash) return go("");
  document.title = `${params.name} - Revision Studio`;
  let root = [0, new Link(hash)];
  let data = localStorage.getItem("OPEN_DIRS");
  let openDirs = data ? JSON.parse(data) : {"":true};

  return function () {
    return h('tree-view', {onclick}, [
      h('ul', [].concat(render("", params.name, root)))
    ]);
  }

  function onclick(evt) {
    let node = evt.target;
    while (!node.dataset.type) {
      node = node.parentElement
      if (node === document.body) return;
    }
    let data = node.dataset;
    if (data.type === 'tree') {
      openDirs[data.path] = !openDirs[data.path];
      localStorage.setItem("OPEN_DIRS", JSON.stringify(openDirs));
      projector.scheduleRender();
      return;
    }
    console.log(data.type, data.path);
  }

  function render(path, name, node) {
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
        entries.push(render(subPath, key, children[key]));
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
});

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

import { run } from "./async";
import { readCommit } from "./github";
import { save, load } from "./cas";
import { idbKeyval as storage } from "./idb-keyval";
import { domBuilder } from "./dombuilder";
import { guess } from "./mime";

window.storage = storage;
let $ = {};
function render(root) {
  let tree = [
    renderTreeView(root),
    ["tree-resizer"],
    ["editor-view",
      ["iframe$iframe", {frameBorder:0}]
    ]
  ]
  document.body.textContent = "";
  document.body.appendChild(domBuilder(tree, $));
}

function renderTreeView(root) {
  return ["tree-view", {onclick:onClick},
    ["ul",
      renderTree("", "", root)
    ]
  ];
  function onClick(evt) {
    let node = evt.target;
    while (!node.dataset.path) {
      node = node.parentElement
      if (node === document.body) return;
    }
    let data = node.dataset;
    let url = `/${$.root}/${data.path}`;
    $.iframe.setAttribute("src", url);
  }
}

function renderTree(path, name, node) {
  let entries = [];
  for (let key in node) {
    let subPath = (path ? path + "/" : "") + key;
    let sub = node[key];
    entries.push(
      (sub.constructor === Object ? renderTree :
       typeof sub === "string" ? renderLink :
       renderFile)(subPath, key, sub)
    );
  }
  let displayName = name || $.name;
  let icon = "icon-down-dir";
  return ["li",
    { class: icon,
      title: name,
      'data-type': 'tree',
      'data-name': name,
      'data-path': path },
    ["span.icon-folder", displayName],
    ["ul"].concat(entries)
  ];
}
function renderLink(path, name, target) {
  let icon = "icon-link";
  return ["li",
    { title: target,
      'data-type': 'link',
      'data-target': target,
      'data-name': name,
      'data-path': path },
    ["span", { class: icon }, name]
  ];
}
function renderFile(path, name) {
  let mime = guess(path);
  let icon = guessIcon(mime);
  return ["li",
    { title: name,
      'data-type': 'file',
      'data-mime': mime,
      'data-name': name,
      'data-path': path },
    ["span", { class: icon }, name]
  ];
}

function guessIcon(mime) {
  if (/^image/.test(mime)) return "icon-file-image";
  if (/^audio/.test(mime)) return "icon-file-audio";
  if (/^video/.test(mime)) return "icon-file-video";
  if (/^video/.test(mime)) return "icon-file-video";
  if (/^application.*(javascript|json|xml)$/.test(mime) ||
      /^text.*(src|html|css|lua)$/.test(mime)) return "icon-file-code";
  if (/^text/.test(mime)) return "icon-doc-text";
  return "icon-doc";
}

// Register a service worker to serve it out as static content.
navigator.serviceWorker.register("worker.js");

run(function*() {

  let match = window.location.hash.match(/github:\/\/([^\/]+)\/([^\/]+)\/refs\/(.+)$/);
  let owner, repo, ref;
  if (match) {
    owner = match[1];
    repo = match[2];
    ref = match[3];
  }
  else {
    owner = "creationix";
    repo = "revision";
    ref = "heads/master";
  }
  $.name = `${owner}/${repo}`;
  let key = `github://${owner}/${repo}/refs/${ref}`;
  window.location.hash = key;
  // Import repository from github into local CAS graph
  let root = yield storage.get(key);
  if (!root) {
    console.log(`Importing github://${owner}/${repo}/refs/${ref}`);
    let commit = yield* readCommit(owner, repo, ref);
    let link = yield* save(commit);
    root = link.toHex();
    yield storage.set(key, link.toHex());
  }
  $.root = root;

  render(yield* load(root));

}());

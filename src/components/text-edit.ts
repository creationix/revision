import { h, VNode } from "../libs/maquette"
import { projector, style } from "../libs/router"
import { isUTF8, binToStr, strToBin } from "../libs/bintools"
import { guess } from "../libs/mime";
import { loadBlob, saveBlob, loadTree, saveTree } from "../libs/link"
import { aliases } from "../libs/aliases"
import { treeMode } from "../libs/git-codec";
import { assert } from "../libs/assert";

let entries = {};

function binToHexBytes(bin) {
  let lines = [];
  let line = [];
  for (let i = 0; i < bin.length; i++) {
    let b = bin[i];
    let hex = ((b < 0x10) ? '0' : '') + b.toString(16);
    line.push(hex);
    if (line.length >= 32) {
      lines.push(line.join(" "));
      line.length = 0;
    }
  }
  return lines.join("\n");
}

function eq(original : string|Uint8Array, value: string|Uint8Array): boolean {
  if (typeof original !== typeof value) return false;
  if (typeof value === 'string' || typeof original === 'string') {
    return original === value;
  }
  if (original.length !== value.length) return false;
  for (let i = 0, l = original.length; i < l; i++) {
    if (original[i] !== value[i]) return false;
  }
  return true;
}

export interface TextEdit {
  (): VNode
  set: (path: string, hash: string) => Promise<void>
  rootName: string,
  path?: string,
  hash?: string,
  original? : string | Uint8Array, // Original value from saved hash (for dirty check)
  value?: string | Uint8Array // set to actual text content
}

export function TextEdit(rootName) {
  let editor = render as TextEdit
  let saving
  editor.set = set;
  editor.rootName = rootName;
  return editor

  async function set(path, hash) {
    if (editor.hash) {
      await save();
    }
    editor.path = path;
    editor.hash = hash;
    projector.scheduleRender();
    let bin = await loadBlob(hash);
    if (isUTF8(bin)) {
      editor.original = editor.value = binToStr(bin);
    }
    else {
      editor.original = editor.value = bin;
    }
    projector.scheduleRender();

  }

  function render() {
    let body;
    if (!editor.hash) {
      body = h('p', ["Click on a file in the left to edit here"]);
    }
    else if (editor.value == null) {
      body = h('p', ["Loading content for " + editor.path + "..."]);
    }
    else {
      let dirty = !eq(editor.original, editor.value)
      body = [
        h('p', editor.path + (dirty ? "*" : "")),
        h('pre', [
          h('textarea', { onkeyup, onblur }, typeof editor.value === "string" ? editor.value : binToHexBytes(editor.value))
        ])
      ];
      if (dirty) {
        body.push(h('button.sync.pure-button', {onclick:save}, "Save"));
      }
    }

    return h('text-edit', body);
  }

  function onkeyup(evt) {
    editor.value = evt.target.value;
    projector.scheduleRender();
    // if (entry.timeout) clearTimeout(entry.timeout);
    // entry.timeout = setTimeout(save, 500, entry, evt.target.value);
  }

  function onblur(evt) {
    save();
  }

  async function save(explicit?) {
    if (editor.value == null) return;
    if (eq(editor.value, editor.original)) return;
    if (saving) return;
    saving = true;

    // Load parent tree nodes
    let hash = await aliases.get(editor.rootName);
    console.log(`Read ${editor.rootName} as ${hash}`);
    let tree = await loadTree(hash);
    let parents = [tree];
    let parts = editor.path.split("/");
    assert(editor.rootName === parts.shift());
    outer: for (let part of parts) {
      if (!tree) throw new Error("Not a folder: " + part);
      for (let entry of tree) {
        if (entry.name === part) {
          hash = entry.hash;
          if (entry.mode === treeMode) {
            tree = await loadTree(hash);
            parents.push(tree);
          }
          continue outer;
        }
      }
      throw new Error("No such path: " + part);
    }

    // Make sure we're sane
    assert(hash === editor.hash);


    // Save the modified file as a new blob
    let bin;
    if (typeof editor.value === "string") bin = strToBin(editor.value);
    else bin = editor.value;
    hash = await saveBlob(bin);
    editor.hash = hash;
    editor.original = editor.value;
    console.log("Saved new blob", hash);

    // Save parent tree nodes
    parts = editor.path.split("/");
    parts.shift();
    while (parents.length) {
      let part = parts.pop();
      let tree = parents.pop();
      let found = false;
      for (let entry of tree) {
        if (entry.name === part) {
          entry.hash = hash;
          found = true;
          break;
        }
      }
      if (!found) throw new Error("Problem saving parent nodes");
      hash = await saveTree(tree);
      console.log("Saved new tree", hash);
    }
    await aliases.set(editor.rootName, hash);
    console.log(`Moved ${editor.rootName} to ${hash}`);

    projector.scheduleRender();

    saving = false;
  }

}

style(`
text-edit p {
  text-align: center;
  height: 30px;
  line-height: 30px;
  margin: 0;
  width: 100%;
  position: absolute;
  top: 0;
}
text-edit textarea {
  position: absolute;
  top: 30px;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: auto;
  background-color: #555;
  color: #fff;
  border: 0;
}

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

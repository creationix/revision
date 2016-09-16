import { h, VNode } from "../libs/maquette"
import { projector, style } from "../libs/router"
import { isUTF8, binToStr, strToBin } from "../libs/bintools"
import { guess } from "../libs/mime";
import { loadBlob } from "../libs/link"

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
  editor.set = set;
  editor.rootName = rootName;
  return editor

  async function set(path, hash) {
    editor.path = path;
    editor.hash = hash;
    projector.scheduleRender();
    if (editor.hash && editor.original !== editor.value) {
      console.log("TODO: save old document", editor)
    }
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
      body = [
        eq(editor.original, editor.value) ?
          h('p', editor.path) :
          h('p', editor.path + "* ",
            h("button.sync.pure-button", {onclick:save}, "Save")),
        h('pre', [
          h('textarea', { onkeyup }, typeof editor.value === "string" ? editor.value : binToHexBytes(editor.value))
        ])
      ]
    }
    return h('text-edit', [].concat(body));
  }

  function onkeyup(evt) {
    // if (entry.timeout) clearTimeout(entry.timeout);
    // entry.timeout = setTimeout(save, 500, entry, evt.target.value);
  }

  async function save(evt) {
    console.log("SAVE", evt);
    // entry.content = strToBin(text);
    // console.log("Saving", entry);
    // await saveFile(entry, entry.content);
    // projector.scheduleRender();
    //
    // console.log("TODO: save", entry, text);
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
`)

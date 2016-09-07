import { h } from "../libs/maquette"
import { projector, style } from "../libs/router"
import { loadFile, saveFile } from "../libs/fs"
import { isUTF8, binToStr, strToBin } from "../libs/bintools"
import { fromTextArea } from "codemirror"
import { guess } from "../libs/mime";

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
text-edit code {
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

let entries = {};

function highlight(path, text) {
  let mime = guess(path, ()=>true);
  console.log(mime);
  return text;
}

export function TextEdit() {
  let entry;
  render.set = data => {
    entry = entries[data.path];
    if (!entry) {
      entry = entries[data.path] = {
        path: data.path,
        name: data.name,
        hash: data.hash
      };
    }
    console.log(entry);
    projector.scheduleRender();
  };
  return render;

  function render() {
    let body;
    if (!entry) {
      body = h('p', ["Click on a file in the left to edit here"]);
    }
    else if (entry.binary) {
      body = h('p', [entry.path + " is a binary file, choose another."]);
    }
    else if (entry.content == null) {
      body = h('p', ["Loading content for " + entry.name + "..."]);
      load(entry);
    }
    else {
      body = [
        h('p', [entry.path + (entry.dirty ? "*" : "")]),
        h('pre', [
          h('code', {contentEditable:true, onkeyup }, highlight(entry.path, binToStr(entry.content)))
        ])
      ]
    }
    return h('text-edit', [].concat(body));
  }

  function onkeyup(evt) {
    if (entry.timeout) clearTimeout(entry.timeout);
    entry.timeout = setTimeout(save, 500, entry, evt.target.value);
  }

  async function load(entry) {
    console.log("Loading", entry);
    let bin = await loadFile(entry);
    if (isUTF8(bin)) {
      entry.content = bin;
    }
    else {
      entry.binary = true;
    }
    projector.scheduleRender();
  }

  async function save(entry, text) {
    entry.content = strToBin(text);
    console.log("Saving", entry);
    await saveFile(entry, entry.content);
    projector.scheduleRender();

    console.log("TODO: save", entry, text);
  }

}

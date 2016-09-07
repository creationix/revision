import { route } from "./libs/router";
import { go, restore } from "./libs/router"
import { ProgressBar } from "./components/progress-bar"

route("export/:name", function saveProject(params: {name:string}) {
  let hash = localStorage.getItem(params.name);
  if (!hash) throw new Error("No such name: " + params.name);
  go(`upload/${hash}`, `edit/${params.name}`);
});

route("import/:name/:hash", function importProject(params: {name:string,hash:string}) {
  let name = params.name;
  document.title = `Importing ${name} - Revision Studio`;
  let i = 0;
  let base = name;
  while (localStorage.getItem(name)) {
    name = `${base}-${++i}`;
  }
  localStorage.setItem(params.name, params.hash);
  go(`download/${params.hash}`, `edit/${params.name}`);
});

let url = (""+document.location.origin + "/").replace(/^http/, 'ws');

route("upload/:hash", function uploadHash(params:{hash:string}) {
  let hash = params.hash;
  document.title = `Uploading ${hash} - Revision Studio`;
  let value = 0,
      max = 0;

  let progress = ProgressBar(`Uploading ${name}`);
  var worker = new Worker("upload-worker.js");
  worker.postMessage({ url, hash });
  worker.onmessage = function (evt) {
    if (evt.data === 1) progress.update(value, ++max);
    else if (evt.data === -1) progress.update(++value, max);
    else onDone(evt.data);
  };

  return progress;

  function onDone(missing) {
    console.log("Done Uploading", missing);
    restore();
  }
});

route("download/:hash", function downloadHash(params:{hash:string}) {
  let hash = params.hash;
  document.title = `Downloading ${hash} - Revision Studio`;
  let value = 0,
      max = 0;

  let progress = ProgressBar(`Downloading ${name}`);
  var worker = new Worker("download-worker.js");
  worker.postMessage({ url, hash });
  worker.onmessage = function (evt) {
    if (evt.data === 1) progress.update(value, ++max);
    else if (evt.data === -1) progress.update(++value, max);
    else onDone(evt.data);
  };

  return progress;

  function onDone(missing) {
    console.log("Done Downloading", missing);
    restore();
  }
});

import { save } from "./cas";
import { runAll } from "./async";
import { idbKeyval as storage } from "./idb-keyval";

let modeToType = {
   '40000': 0, // tree
  '040000': 0, // tree
  '100644': 1, // blob
  '100755': 2, // exec
  '120000': 3, // sym
  '160000': 4  // commit
};
let modeToImport = {
   '40000': importTree, // tree
  '040000': importTree, // tree
  '100644': importBlob, // blob
  '100755': importBlob, // exec
  '120000': importBlob, // sym
  '160000': importSubmodule  // commit
}


let authorization;
function* get(path, format) {
  format = format || "json";
  let url = `https://api.github.com/${path}`;
  let headers = {
    Accept: format === 'arrayBuffer' || format === 'text' ?
      "application/vnd.github.v3.raw" :
      "application/vnd.github.v3+json"
  };
  if (authorization === undefined) {
    authorization = yield storage.get("GITHUB_AUTHORIZATION") || false;
    if (authorization) console.log("Using GITHUB_AUTHORIZATION");
  }
  if (authorization) headers.Authorization = `Basic ${authorization}`;
  let res = yield fetch(url, {headers:headers});
  return res && (yield res[format]());
}

export function* deref(owner, repo, ref) {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  let result = yield* get(`repos/${owner}/${repo}/git/refs/${ref}`);
  return result && result.object.sha;
}

function* gitLoad(owner, repo, type, sha) {
  let result = yield storage.get(sha);
  if (result) return result;
  result = yield* get(
    `repos/${owner}/${repo}/git/${type}s/${sha}`,
    type === "blob" ? "arrayBuffer" : "json"
  );
  if (!result) return;
  yield storage.set(sha, result);
  return result;
}

export function* importBlob(owner, repo, sha, filename) {
  sha = yield* deref(owner, repo, sha);
  let data = yield* gitLoad(owner, repo, "blob", sha);
  let file = {
    file: new Uint8Array(data)
  };
  if (filename) file.name = filename;
  console.log(file);
  return yield* save(file);
}

function parseGitmodules(arr) {
  let text = "";
  for (let i = 0, l = arr.length; i <l; i++) {
    text += String.fromCharCode(arr[i]);
  }
  let config = {};
  let section;
  text.split(/[\r\n]+/).forEach(function (line) {
    let match = line.match(/\[([^ \t"\]]+) *(?:"([^"]+)")?\]/);
    if (match) {
      section = config[match[1]] || (config[match[1]] = {});
      if (match[2]) {
        section = section[match[2]] = {};
      }
      return;
    }
    match = line.match(/([^ \t=]+)[ \t]*=[ \t]*(.+)/);
    if (match) {
      section[match[1]] = match[2];
    }
  });
  return config;
}

export function* importTree(owner, repo, sha, filename, path, gitmodules) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, "tree", sha);
  let tasks = [];
  for (let entry of result.tree) {
    if (!gitmodules && entry.path === ".gitmodules") {
      gitmodules = parseGitmodules(
        new Uint8Array(yield* gitLoad(owner, repo, "blob", entry.sha))
      );
    }
    let newPath = path ? `${path}/${entry.path}` : entry.path;
    tasks.push(modeToImport[entry.mode](
      owner, repo, entry.sha, entry.path, newPath, gitmodules
    ));
  }
  let entries = (yield runAll(tasks)).map(function (link, i) {
    let entry = result.tree[i];
    return [
      modeToType[entry.mode],
      entry.path,
      link
    ];
  });
  let tree = {tree:entries}
  if (filename) tree.name = filename;
  console.log(tree);
  return yield* save(tree);
}

export function* importCommit(owner, repo, sha) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, "commit", sha);
  let release = {
    owner: owner,
    repo: repo,
    root: yield* importTree(owner, repo, result.tree.sha)
  };
  console.log(release);
  return yield* save(release);
}

export function* importSubmodule(owner, repo, sha, filename, path, gitmodules) {
  let remote;
  for (let key in gitmodules.submodule) {
    let sub = gitmodules.submodule[key];
    if (sub.path === path) {
      remote = sub.url;
      break;
    }
  }
  if (!remote) throw new Error(`No gitmodules entry for ${path}`);
  let match = remote.match(/github.com[:\/]([^\/]+)\/(.+?)(\.git)?$/);
  if (!match) throw new Error(`Submodule is not on github ${remote}`);
  return yield* importCommit(match[1], match[2], sha);
}

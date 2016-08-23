import { save } from "./cas";
import { runAll } from "./async";
import { idbKeyval as storage } from "./idb-keyval";

let modeToRead = {
   '40000': readTree, // tree
  '040000': readTree, // tree
  '100644': readBlob, // blob
  '100755': readExec, // exec
  '120000': readSym, // sym
  '160000': readSubmodule  // commit
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

function* deref(owner, repo, ref) {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  let result = yield* get(`repos/${owner}/${repo}/git/refs/${ref}`);
  return result && result.object.sha;
}

function* gitLoad(owner, repo, type, sha) {
  let result;
  // result = yield storage.get(sha);
  // if (result) return result;
  result = yield* get(
    `repos/${owner}/${repo}/git/${type}s/${sha}`,
    type === "blob" ? "arrayBuffer" : "json"
  );
  if (!result) return;
  if (type === "blob") result = new Uint8Array(result);
  // yield storage.set(sha, result);
  return result;
}

function bufToString(buf) {
  let str = "";
  for (let i = 0, l = buf.length; i <l; i++) {
    str += String.fromCharCode(buf[i]);
  }
  return str;
}

function parseGitmodules(buf) {
  let text = bufToString(buf);
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

function* readSym(owner, repo, sha) {
  let buf = yield* gitLoad(owner, repo, "blob", sha);
  return bufToString(buf);
}

function* readExec(owner, repo, sha) {
  let buf = yield* gitLoad(owner, repo, "blob", sha);
  // We're throwing away the exec bit
  return yield* save(buf);
}

function* readBlob(owner, repo, sha) {
  let buf = yield* gitLoad(owner, repo, "blob", sha);
  return yield* save(buf);
}

export function* readTree(owner, repo, sha, path, gitmodules) {
  let result = yield* gitLoad(owner, repo, "tree", sha);
  let tasks = [];
  for (let entry of result.tree) {
    if (!gitmodules && entry.path === ".gitmodules") {
      gitmodules = parseGitmodules(
        yield* gitLoad(owner, repo, "blob", entry.sha)
      );
    }
    let newPath = path ? `${path}/${entry.path}` : entry.path;
    tasks.push(modeToRead[entry.mode](
      owner, repo, entry.sha, newPath, gitmodules
    ));
  }
  let tree = {};
  (yield runAll(tasks)).forEach(function (item, i) {
    let entry = result.tree[i];
    tree[entry.path] = item;
  });
  return tree;
}

export function* readCommit(owner, repo, sha) {
  sha = yield* deref(owner, repo, sha);
  let commit = yield* gitLoad(owner, repo, "commit", sha);
  // We're throwing away the commit information and returning the tree directly.
  return yield* readTree(owner, repo, commit.tree.sha);
}

function* readSubmodule(owner, repo, sha, path, gitmodules) {
  let remote;
  for (let key in gitmodules.submodule) {
    let sub = gitmodules.submodule[key];
    if (sub.path !== path) continue;
    remote = sub.url;
    break;
  }
  if (!remote) throw new Error(`No gitmodules entry for ${path}`);
  let match = remote.match(/github.com[:\/]([^\/]+)\/(.+?)(\.git)?$/);
  if (!match) throw new Error(`Submodule is not on github ${remote}`);
  // Throw away the submodule information and reuturn the tree.
  return yield* readCommit(match[1], match[2], sha);
}

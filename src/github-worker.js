import { save } from "./libs/cas-idb"
import { run, runAll } from "./libs/async"
import { binToStr } from "./libs/bintools"

let GITHUB_ACCESS_TOKEN;
self.onmessage = function(evt) {
  GITHUB_ACCESS_TOKEN = evt.data.token;
  console.log("TOKEN", GITHUB_ACCESS_TOKEN)
  run(readCommit(evt.data.owner, evt.data.repo, evt.data.ref))
    .then(self.postMessage)
    .catch(self.postMessage);
};

function* get(path, format) {
  format = format || "json";
  let url = `https://api.github.com/${path}`;
  let headers = {
    Accept: format === 'arrayBuffer' || format === 'text' ?
      "application/vnd.github.v3.raw" :
      "application/vnd.github.v3+json"
  };

  if (GITHUB_ACCESS_TOKEN) {
    headers.Authorization = `token ${GITHUB_ACCESS_TOKEN}`;
  }
  let res = yield fetch(url, {headers:headers});
  return res && (yield res[format]());
}

function* gitLoad(owner, repo, sha, type) {
  self.postMessage(1);
  let result = yield* get(
    `repos/${owner}/${repo}/git/${type}s/${sha}`,
    type === "blob" ? "arrayBuffer" : "json"
  );
  if (result) {
    if (type === "blob") result = new Uint8Array(result);
  }
  self.postMessage(-1);
  return result;
}

function parseGitmodules(bin) {
  let str = binToStr(bin);
  let config = {};
  let section;
  str.split(/[\r\n]+/).forEach(function (line) {
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

function* deref(owner, repo, ref) {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  let result = yield* get(`repos/${owner}/${repo}/git/refs/${ref}`);
  return result && result.object.sha;
}

let modeToRead = {
   '40000': readTree, // tree
  '040000': readTree, // tree
  '100644': readBlob, // blob
  '100755': readExec, // exec
  '120000': readSym, // sym
  '160000': readSubmodule  // commit
}

function* readCommit(owner, repo, sha) {
  sha = yield* deref(owner, repo, sha);
  let commit = yield* gitLoad(owner, repo, sha, "commit");
  // We're throwing away the commit information and returning the tree directly.
  return yield* readTree(owner, repo, commit.tree.sha);
}

function* readTree(owner, repo, sha, path, gitmodules) {
  let result = yield* gitLoad(owner, repo, sha, "tree");
  let tasks = [];
  for (let entry of result.tree) {
    if (!gitmodules && entry.path === ".gitmodules") {
      gitmodules = parseGitmodules(
        yield* gitLoad(owner, repo, entry.sha, "blob")
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
  return [0, yield* save(tree)];
}

function* readBlob(owner, repo, sha) {
  let buf = yield* gitLoad(owner, repo, sha, "blob");
  return [1, yield* save(buf)];
}

function* readExec(owner, repo, sha) {
  let buf = yield* gitLoad(owner, repo, sha, "blob");
  return [2, yield* save(buf)];
}

function* readSym(owner, repo, sha) {
  let bin = yield* gitLoad(owner, repo, sha, "blob");
  return binToStr(bin);
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
  return [0, yield* readCommit(match[1], match[2], sha), remote, sha];
}

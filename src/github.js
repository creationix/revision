import { save } from "./cas";
import { runAll } from "./async";
import { idbKeyval as storage } from "./idb-keyval";

function* get(path, format) {
  format = format || "json";
  let url = `https://api.github.com/${path}`;
  let headers = {
    Accept: format === 'arrayBuffer' || format === 'text' ?
      "application/vnd.github.v3.raw" :
      "application/vnd.github.v3+json"
  };
  let username = (yield storage.get("GITHUB_USERNAME")) ||
    prompt("Enter github username (for API auth)");
  if (username) yield storage.set("GITHUB_USERNAME", username);
  let token = (yield storage.get("GITHUB_TOKEN")) ||
    prompt("Enter personal access token (for API auth)");
  if (token) yield storage.set("GITHUB_TOKEN", token);
  headers.Authorization = `Basic ${btoa(`${username}:${token}`)}`;
  let res = yield fetch(url, {headers:headers});
  return res && (yield res[format]());
}

export function* importCommit(owner, repo, rootSha, onStart, onFinish) {

  let modeToRead = {
     '40000': readTree, // tree
    '040000': readTree, // tree
    '100644': readBlob, // blob
    '100755': readExec, // exec
    '120000': readSym, // sym
    '160000': readSubmodule  // commit
  }

  return yield* readCommit(rootSha);

  function* deref(ref) {
    if (/^[0-9a-f]{40}$/.test(ref)) return ref;
    let result = yield* get(`repos/${owner}/${repo}/git/refs/${ref}`);
    return result && result.object.sha;
  }

  function* gitLoad(type, sha) {
    onStart(sha);
    let result;// = yield storage.get(sha);
    if (!result) {
      result = yield* get(
        `repos/${owner}/${repo}/git/${type}s/${sha}`,
        type === "blob" ? "arrayBuffer" : "json"
      );
      if (result) {
        if (type === "blob") result = new Uint8Array(result);
        // yield storage.set(sha, result);
      }
    }
    onFinish(sha);
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

  function* readSym(sha) {
    let buf = yield* gitLoad("blob", sha);
    return bufToString(buf);
  }

  function* readExec(sha) {
    let buf = yield* gitLoad("blob", sha);
    // We're throwing away the exec bit
    return yield* save(buf);
  }

  function* readBlob(sha) {
    let buf = yield* gitLoad("blob", sha);
    return yield* save(buf);
  }

  function* readTree(sha, path, gitmodules) {
    let result = yield* gitLoad("tree", sha);
    let tasks = [];
    for (let entry of result.tree) {
      if (!gitmodules && entry.path === ".gitmodules") {
        gitmodules = parseGitmodules(
          yield* gitLoad("blob", entry.sha)
        );
      }
      let newPath = path ? `${path}/${entry.path}` : entry.path;
      tasks.push(modeToRead[entry.mode](
        entry.sha, newPath, gitmodules
      ));
    }
    let tree = {};
    (yield runAll(tasks)).forEach(function (item, i) {
      let entry = result.tree[i];
      tree[entry.path] = item;
    });
    return tree;
  }

  function* readCommit(sha) {
    sha = yield* deref(sha);
    let commit = yield* gitLoad("commit", sha);
    // We're throwing away the commit information and returning the tree directly.
    return yield* readTree(commit.tree.sha);
  }

  function* readSubmodule(sha, path, gitmodules) {
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
    // Throw away the submodule information and return the tree.
    return yield* importCommit(match[1], match[2], sha, onStart, onFinish);
  }
}

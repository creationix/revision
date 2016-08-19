import { save } from "./cas";
import { decode } from "./base64";
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

function decodeContent(content, encoding) {
  if (encoding !== "base64") {
    throw new Error("Unknown content encoding from github: " + encoding);
  }
  return decode(content);
}

export function* importSubmodule(owner, repo, sha) {
  throw new Error(
    `TODO: Implement submodule importing: ${owner}/${repo}/${sha}`
  );
}

export function* deref(owner, repo, ref) {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  var url=`https://api.github.com/repos/${owner}/${repo}/git/refs/${ref}`;
  let result = yield (yield fetch(url)).json();
  return result.object.sha;
}

function* gitLoad(owner, repo, type, sha) {
  let result = yield storage.get(sha);
  if (result) return result;
  var url=`https://api.github.com/repos/${owner}/${repo}/git/${type}s/${sha}`;
  result = yield (yield fetch(url)).json();
  yield storage.set(sha, result);
  return result;
}

export function* importBlob(owner, repo, sha, filename) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, "blob", sha);
  let file = {
    file: decodeContent(result.content, result.encoding)
  };
  if (filename) file.name = filename;
  return yield* save(file);
}

export function* importTree(owner, repo, sha, filename) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, "tree", sha);
  let tasks = [];
  for (let entry of result.tree) {
    tasks.push(modeToImport[entry.mode](owner, repo, entry.sha, entry.path));
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
  return yield* save(tree);
}

export function* importCommit(owner, repo, sha) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, "commit", sha);
  let release = {
    root: yield* importTree(owner, repo, result.tree.sha)
  };
  return yield* save(release);
}

import { run, runAll } from "./libs/async"
import { binToStr } from "./libs/bintools"
import { saveCommit, saveTree, saveBlob } from "./libs/link"
import { frameCommit } from "./libs/git-codec"
import { sha1 } from "./libs/sha1"
import "./libs/cas-idb"

let GITHUB_ACCESS_TOKEN;
self.onmessage = function(evt) {
  GITHUB_ACCESS_TOKEN = evt.data.token;
  run(readCommit(evt.data.owner, evt.data.repo, evt.data.ref))
    .then((out) => {
      self.postMessage(out);
    })
    .catch(err => {
      throw err;
    });
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
  '100755': readBlob, // exec
  '120000': readBlob, // sym
  '160000': readSubmodule  // commit
}

function decodeCommit(result) {
  return {
    tree: result.tree.sha,
    parents: result.parents.map(function (object) {
      return object.sha;
    }),
    author: pickPerson(result.author),
    committer: pickPerson(result.committer),
    message: result.message
  };
}

function pickPerson(person) {
  return {
    name: person.name,
    email: person.email,
    date: parseDate(person.date)
  };
}

function parseDate(string) {
  // TODO: test this once GitHub adds timezone information
  var match = string.match(/(-?)([0-9]{2}):([0-9]{2})$/);
  var date = new Date(string);
  var timezoneOffset = 0;
  if (match) {
    timezoneOffset = (match[1] === "-" ? 1 : -1) * (
      parseInt(match[2], 10) * 60 + parseInt(match[3], 10)
    );
  }
  return {
    seconds: date.valueOf() / 1000,
    offset: timezoneOffset
  };
}

function* readCommit(owner, repo, sha) {
  sha = yield* deref(owner, repo, sha);
  let result = yield* gitLoad(owner, repo, sha, "commit");
  let treeHash = yield* readTree(owner, repo, result.tree.sha);
  if (treeHash !== result.tree.sha) {
    console.error("tree hash mismatch");
  }
  let commit = decodeCommit(result);
  fixDate("commit", commit, sha);
  return yield* saveCommit(commit);
}


// GitHub has a nasty habit of stripping whitespace from messages and losing
// the timezone.  This information is required to make our hashes match up, so
// we guess it by mutating the value till the hash matches.
// If we're unable to match, we will just force the hash when saving to the cache.
function fixDate(type, value, hash) {
  if (type !== "commit" && type !== "tag") return;
  // Add up to 3 extra newlines and try all 30-minutes timezone offsets.
  var clone = JSON.parse(JSON.stringify(value));
  let frame = type === "commit" ? frameCommit : null;
  for (var x = 0; x < 3; x++) {
    for (var i = -720; i < 720; i += 30) {
      if (type === "commit") {
        clone.author.date.offset = i;
        clone.committer.date.offset = i;
      }
      else if (type === "tag") {
        clone.tagger.date.offset = i;
      }
      let actual = sha1(frame(clone));
      if (hash !== actual) continue;
      // Apply the changes and return.
      value.message = clone.message;
      if (type === "commit") {
        value.author.date.offset = clone.author.date.offset;
        value.committer.date.offset = clone.committer.date.offset;
      }
      else if (type === "tag") {
        value.tagger.date.offset = clone.tagger.date.offset;
      }
      return true;
    }
    clone.message += "\n";
  }
  return false;
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
  let tree = [];
  (yield runAll(tasks)).forEach(function (item, i) {
    let entry = result.tree[i];
    if (entry.sha !== item) {
      console.log(entry);
      console.error("HASH mismatch for tree entry: " + entry.path)
    }
    tree.push({
      name: entry.path,
      mode: parseInt(entry.mode, 8),
      hash: item
    });
  });
  return yield* saveTree(tree);
}

function* readBlob(owner, repo, sha) {
  let buf = yield* gitLoad(owner, repo, sha, "blob");
  return yield* saveBlob(buf);
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
  return yield* readCommit(match[1], match[2], sha);
}

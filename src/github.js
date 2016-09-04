import { route } from "./libs/router";
import { h } from "./libs/maquette"
import { go, restore } from "./libs/router"
import { save } from "./libs/cas-idb"
import { run, runAll } from "./libs/async"
import { binToStr } from "./libs/bintools"
import { page } from "./components/page"
import { ProgressBar } from "./components/progress-bar"

route("github-auth", function githubAuth() {
  return page("Github Authentication", [
    h('div.pure-u-1-2', [
      h('p', [
        h('a.pure-button.pure-button-primary', {href: '/github-oauth'}, ['Use Oauth Flow'])
      ]),
      h('p', [
        'Or create a personal access token ',
        h('a', {href:'https://github.com/settings/tokens'}, ['here']),
        '.'
      ]),
      h('form.pure-form', {onsubmit}, [
        h('fieldset', [
          h('input', {name:"token", placeholder:'personal access token'}),
          ' ',
          h('button.pure-button', ["Use Token"]), ' '
        ])
      ])
    ]),
    h('div.pure-u-1-2', [
      h('p', ['GitHub has not yet enabled CORS headers on their git HTTPS endpoints. Therefore it is impossible to do a normal git clone from the browser despite the work that has been done to implement the entire git protocol in pure JS.']),
      h('p', ['We can, however import using the proprietary GitHub API, but this requires authentication to overcome the low rate limits that unauthenticated requests are subject to.'])
    ])
  ]);
  function onsubmit(evt) {
    evt.preventDefault();
    let token = evt.target.token.value;
    if (token) go("github-token/" + token);
  }
});

route("github-token/:token", function githubStoreToken(params) {
  localStorage.setItem("GITHUB_ACCESS_TOKEN", params.token);
  restore();
});

route("github-import", function githubImportForm() {
  if (!localStorage.getItem("GITHUB_ACCESS_TOKEN")) {
    return go("github-auth", true);
  }
  return page("GitHub Import", [
    h('div.pure-u-1-3', [
      h('form.pure-form.pure-form-stacked', {onsubmit}, [
        h('fieldset', [
          h('label', {for:"username"}, ["Username"]),
          h('input', {name:"username",placeholder:'creationix'}),
          h('label', {for:"project"}, ["Project"]),
          h('input', {name:"project",placeholder:'exploder'}),
          h('label', {for:"ref"}, ["Git Ref"]),
          h('input', {name:"ref",placeholder:'heads/master'}),
          h('button.pure-button.pure-button-primary', {type:"submit"}, ["Import"])
        ])
      ])
    ]),
    h('div.pure-u-2-3', [
      h('p', ['This tool will import the latest commit from a repo into your local content-addressable storage graph for use in the revision system.']),
      h('p', ['The Git Ref is optional and defaults to the master branch.'])
    ])
  ]);
  function onsubmit(evt) {
    evt.preventDefault();
    let username = evt.target.username.value;
    let project = evt.target.project.value;
    let ref = evt.target.ref.value || "heads/master";
    if (!(username && project && ref)) return;
    return go(`github-import/${username}/${project}/refs/${ref}`);
  }
});

route("github-import/:owner/:repo/refs/:ref:", function githubImport(params) {
  let token = localStorage.getItem("GITHUB_ACCESS_TOKEN");
  if (!token) return go("github-auth", true);
  let events = { onAdd, onDo };
  let value = 0,
      max = 0;
  let owner = params.owner,
      repo = params.repo,
      ref = params.ref;

  let progress = ProgressBar(`Importing github://${owner}/${repo}/refs/${ref}`);
  run(readCommit(events, owner, repo, ref)).then(onDone).catch(onError);

  return progress.render;

  function onAdd() {
    progress.update(value, ++max);
  }

  function onDo() {
    progress.update(++value, max);
  }

  function onDone(entry) {
    console.log(entry[1].toHex());
    go(`tree/${entry[1].toHex()}`);
  }

  function onError(err) {
    console.error(err);
  }


});

let GITHUB_ACCESS_TOKEN;
function* get(path, format) {
  if (!GITHUB_ACCESS_TOKEN) {
    GITHUB_ACCESS_TOKEN = localStorage.getItem('GITHUB_ACCESS_TOKEN');
  }
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

function* gitLoad(events, owner, repo, sha, type) {
  events.onAdd();
  let result = yield* get(
    `repos/${owner}/${repo}/git/${type}s/${sha}`,
    type === "blob" ? "arrayBuffer" : "json"
  );
  if (result) {
    if (type === "blob") result = new Uint8Array(result);
  }
  events.onDo();
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

function* deref(events, owner, repo, ref) {
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

function* readCommit(events, owner, repo, sha) {
  sha = yield* deref(events, owner, repo, sha);
  let commit = yield* gitLoad(events, owner, repo, sha, "commit");
  // We're throwing away the commit information and returning the tree directly.
  return yield* readTree(events, owner, repo, commit.tree.sha);
}

function* readTree(events, owner, repo, sha, path, gitmodules) {
  let result = yield* gitLoad(events, owner, repo, sha, "tree");
  let tasks = [];
  for (let entry of result.tree) {
    if (!gitmodules && entry.path === ".gitmodules") {
      gitmodules = parseGitmodules(
        yield* gitLoad(events, owner, repo, entry.sha, "blob")
      );
    }
    let newPath = path ? `${path}/${entry.path}` : entry.path;
    tasks.push(modeToRead[entry.mode](
      events, owner, repo, entry.sha, newPath, gitmodules
    ));
  }
  let tree = {};
  (yield runAll(tasks)).forEach(function (item, i) {
    let entry = result.tree[i];
    tree[entry.path] = item;
  });
  return [0, yield* save(tree)];
}

function* readBlob(events, owner, repo, sha) {
  let buf = yield* gitLoad(events, owner, repo, sha, "blob");
  return [1, yield* save(buf)];
}

function* readExec(events, owner, repo, sha) {
  let buf = yield* gitLoad(events, owner, repo, sha, "blob");
  return [2, yield* save(buf)];
}

function* readSym(events, owner, repo, sha) {
  let bin = yield* gitLoad(events, owner, repo, sha, "blob");
  return binToStr(bin);
}

function* readSubmodule(events, owner, repo, sha, path, gitmodules) {
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

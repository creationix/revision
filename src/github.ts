import { route } from "./libs/router";
import { h, VNode } from "./libs/maquette"
import { go, restore } from "./libs/router"
import { binToHex } from "./libs/bintools"
import { page } from "./components/page"
import { ProgressBar } from "./components/progress-bar"

route("github/auth", function githubAuth() {
  document.title = 'Github Authentication - Revision Studio';
  return page("Github Authentication", [
    h('div.pure-u-1.pure-u-md-1-2', [
      h('p', [
        h('a.pure-button.pure-button-primary', {href: '/github/oauth'}, ['Use Oauth Flow'])
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
    h('div.pure-u-1.pure-u-md-1-2', [
      h('p', ['GitHub has not yet enabled CORS headers on their git HTTPS endpoints. Therefore it is impossible to do a normal git clone from the browser despite the work that has been done to implement the entire git protocol in pure JS.']),
      h('p', ['We can, however import using the proprietary GitHub API, but this requires authentication to overcome the low rate limits that unauthenticated requests are subject to.'])
    ])
  ]);
  function onsubmit(evt) {
    evt.preventDefault();
    let token = evt.target.token.value;
    if (token) go("github/token/" + token);
  }
});

route("github/token/:token", function githubStoreToken(params: { token: string}) {
  document.title = 'Storing GitHub Token - Revision Studio';
  localStorage.setItem("GITHUB_ACCESS_TOKEN", params.token);
  restore();
});

route("github/import", function githubImportForm() {
  document.title = 'GitHub Import Form - Revision Studio';
  return page("GitHub Import", [
    h('div.pure-u-1.pure-u-md-1-3', [
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
    h('div.pure-u-2-3.pure-u-md-2-3', [
      h('p', ['This tool will import the latest commit from a repo into your local content-addressable storage graph for use in the revision system.']),
      h('p', ['The Git Ref is optional and defaults to the master branch.'])
    ])
  ]);
  function onsubmit(evt: any) {
    evt.preventDefault();
    let username = evt.target.username.value;
    let project = evt.target.project.value;
    let ref = evt.target.ref.value || "heads/master";
    if (!(username && project && ref)) return;
    return go(`github/import/${username}/${project}/refs/${ref}`);
  }
});

route("github/import/:owner/:repo/refs/:ref:", function githubImport(params: {
  owner: string, repo: string, ref: string
}) {
  let token = localStorage.getItem("GITHUB_ACCESS_TOKEN");
  if (!token) return go("github/auth", true);
  document.title = `Importing ${params.repo}/${params.repo} - Revision Studio`;
  let value = 0,
      max = 0;
  let owner = params.owner,
      repo = params.repo,
      ref = params.ref;

  let progress = ProgressBar(`Importing github://${owner}/${repo}/refs/${ref}`);
  var worker = new Worker("github-worker.js");
  worker.postMessage({token, owner, repo, ref});
  worker.onmessage = function (evt) {
    if (evt.data === 1) progress.update(value, ++max);
    else if (evt.data === -1) progress.update(++value, max);
    else onDone(evt.data);
  };

  return progress;

  function onDone(hex) {
    console.log("Imported", hex);
    go(`${owner}-${repo}/${hex}`);
  }

});

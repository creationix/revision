import { route, go, save, restore } from "./libs/router";
import { h, projector } from "./libs/maquette"
import { style } from "./libs/style-inject";

style(`
  .content-wrapper {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 15px;
  }
`);

function page(title, body) {
  return h('div.content-wrapper', [
    h('h1', [].concat(title)),
    h('div.pure-g', {key:title}, [].concat(body))
  ]);
}

route("", function () {
  return h('a', {href:"#github-import"}, "Import from github");
});

route("github-auth", function () {
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

route("github-token/:token", function (params) {
  localStorage.setItem("GITHUB_ACCESS_TOKEN", params.token);
  restore();
});

route("github-import", function () {
  if (!localStorage.getItem("GITHUB_ACCESS_TOKEN")) {
    save();
    return go("github-auth");
  }
  return page("GitHub Import", [
    h('div.pure-u-1-2', [
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
    h('div.pre-u-1-2', [
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

route("github-import/:user/:name/refs/:ref:", function (params) {
  let token = localStorage.getItem("GITHUB_ACCESS_TOKEN")
  if (!token) {
    save();
    return go("github-auth");
  }
  return h('p', "TODO: do actual import with progress");
});

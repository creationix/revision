// import { ProgressBar } from "./progress-bar";
// import { ScreenShade } from "./screen-shade";
// import { importCommit } from "../libs/github";
import { h, projector } from "../libs/maquette"
import { run } from "../libs/async";
import { push } from "../libs/router";


export function GithubImport(user, name, ref) {
  let error;
  let GITHUB_ACCESS_TOKEN = localStorage.getItem("GITHUB_ACCESS_TOKEN");
  if (!GITHUB_ACCESS_TOKEN) return push("github-auth");
  // let total = 0;
  // let done = 0;

  // run(importCommit(user, name, ref, onStart, onFinish)).catch(console.error);
  run(main()).catch(showError);

  return { render };

  function render() {
    if (error) {
      return h('h1', [''+error]);
    }
    if (!GITHUB_ACCESS_TOKEN) {
      return h('form.pure-form', {onsubmit:cancel}, [
        h('fieldset', [
          h('legend', ['Authentiate with GitHub']),
          h('p', ['GitHub has not yet enabled CORS headers on their git HTTPS endpoints. Therefore it is impossible to do a normal git clone from the browser despite the work that has been done to implement the entire git protocol in pure JS.']),
          h('p', ['We can, however import using the proprietary GitHub API, but this requires authentication to overcome the low rate limits that unauthenticated requests are subject to.']),
          h('a.pure-button.pure-button-primary', {href: '/github-oauth'}, ['Use Oauth Flow']), ' or ',
          h('button.pure-button', ["Use Personal Access Token"]), ' ',
          h('input', {placeholder:'personal access token'}),
          ' available ',
          h('a', {href:'https://github.com/settings/tokens'}, ['here']), '.'
        ])
      ]);
    }
    return h('form.pure-form', [
      h('fieldset', [
        h('legend', ["Import from GitHub"]),
        h('input', {type:'email', placeholder:'Email'}), " ",
        h('input', {type:'password', placeholder:'Password'}), " ",
        h('label', {for:"remember"}, [
          h('input', {id:"remember",type:"checkbox"}), "Remember me"
        ]), " ",
        h('button.pure-button.pure-button-primary', ["Sign in"])
      ])
    ]);
  }

  function cancel(evt) {
    evt.preventDefault();

  }

  function showError(err) {
    error = err;
    projector.scheduleRender();
  }

  function* main() {

  }

  // function onStart() {
  //   progress.update(done, ++total);
  // }
  // function onFinish() {
  //   progress.update(++done, total);
  // }
}

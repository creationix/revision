import { compileRoute } from "./weblit-tools";
import { createProjector } from "./maquette";

export let projector = createProjector();

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

let routes = [];

export function route(pattern, fn) {
  fn.match = compileRoute(pattern);
  routes.push(fn);
}

let last = '';
let oldRender;
function router() {
  var url = location.hash.slice(1) || '';
  console.log("Route Change", url);
  for (let route of routes) {
    let params = route.match(url);
    if (!params) continue;
    last = url;
    let render = route(params);
    if (!render) return;
    if (typeof render !== 'function') {
      let value = render;
      render = () => value;
    }
    if (oldRender) {
      projector.detach(oldRender);
      document.body.textContent = '';
    }
    oldRender = render;
    projector.append(document.body, render);
    return;
  }
  location.hash = last;
}

export function go(path) {
  location.hash = path;
}

export function save() {
  localStorage.setItem("hash", location.hash);
}

export function restore() {
  let path = localStorage.getItem("hash") || '';
  localStorage.removeItem("hash", location.hash);
  location.hash = path;
}

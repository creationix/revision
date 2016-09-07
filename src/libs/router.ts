import { compileRoute } from "./weblit-tools";
import { createProjector } from "./maquette";
import { notFound } from "../components/notfound"

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
    if (render === false) render = notFound;
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

export function go(path, preserve) {
  if (preserve) {
    if (preserve === true) preserve = location.hash;
    localStorage.setItem("ROUTE_BOOKMARK", preserve);
  }
  location.hash = path;
}

export function restore() {
  let path = localStorage.getItem("ROUTE_BOOKMARK") || '';
  localStorage.removeItem("ROUTE_BOOKMARK", location.hash);
  location.hash = path;
}

let styles = [];
let dirty = false;

export function style(css) {
  if (!dirty) requestAnimationFrame(update);
  dirty = true;
  styles.push(css);
}

function update() {
  if (!dirty) return;
  dirty = false;
  let style = document.createElement("style");
  style.textContent = styles.join("\n")
  styles.length = 0;
  document.head.appendChild(style);
}

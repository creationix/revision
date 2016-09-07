import { compileRoute } from "./weblit-tools";
import { createProjector, VNode } from "./maquette";
import { notFound } from "../components/notfound"

export let projector = createProjector({});

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

let routes = [];

interface Route {
  (params?: Object): boolean | VNode | (() => VNode)
  match?: (path: string) => (void | Object)
}

export function route(pattern: string, fn: Route) {
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
    let result = route(params);
    if (result === false) continue;
    if (result === true) return;
    return redraw((typeof result === 'function') ? result : ()=>result);
  }
  redraw(notFound);
}

function redraw(render) {
  if (oldRender) {
    projector.detach(oldRender);
    document.body.textContent = '';
  }
  oldRender = render;
  projector.append(document.body, render);
}


export function go(path: string, preserve?: string|boolean) {
  if (preserve) {
    if (preserve === true) preserve = location.hash;
    localStorage.setItem("ROUTE_BOOKMARK", preserve as string);
  }
  location.hash = path;
}

export function restore() {
  let path = localStorage.getItem("ROUTE_BOOKMARK") || '';
  localStorage.removeItem("ROUTE_BOOKMARK");
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

export function parseQuery(query) {
  let params = {}
  for (let part of query.split("&")) {
    let match = part.match(/^([^=]+)=(.*)$/)
    if (!match) continue;
    let key = decodeURIComponent(match[1]),
        value = decodeURIComponent(match[2]);
    params[key] = value;
  }
  return params;
}

function escapeRegex(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

export function compileGlob(glob) {
  let reg = new RegExp(glob.split("*").map(escapeRegex).join(".*"));
  return function (string) {
    return reg.test(string)
  }
}

export function compileRoute(route) {
  let names = [];
  let reg = new RegExp("^" + route.split(/(:[a-z0-9_]+:?)/).map(function (part, i) {
    if (i % 2) {
      if (part[part.length - 1] === ':') {
        names.push(part.substr(1, part.length - 2));
        return "(.+)";
      }
      names.push(part.substr(1));
      return "([^/]+)";
    }
    return escapeRegex(part);
  }).join("") + "$");
  return function (str) {
    let match = str.match(reg);
    if (!match) return;
    let params = {};
    for (let i = 0, l = names.length; i < l; i++) {
      params[names[i]] = match[i + 1];
    }
    return params;
  }
}

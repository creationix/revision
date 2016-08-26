export function pathJoin(base, ...parts) {
  parts = (base + "/" + parts.join("/")).split(/\/+/);
  let i = 0;
  while (i < parts.length) {
    let part = parts[i];
    if (!part || part === '.') parts.splice(i, 1);
    else if (part !== '..') i++;
    else {
      parts.splice(i - 1, 2);
      i--;
      if (i < 0) i = 0;
    }
  }
  return (base[0] === '/' ? '/' : '') + parts.join("/");
}

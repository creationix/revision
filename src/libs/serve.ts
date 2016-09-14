import { guess } from "./mime";
import { pathJoin } from "./pathjoin";
import { loadTree, loadBlob } from "./link"
import { isUTF8, binToStr } from "./bintools"
import { treeMode, blobMode, symMode, execMode } from "./git-codec"

export async function serve(rootName: string, rootHash: string, path: string) {
  let entry = {
    name: rootName,
    mode: treeMode,
    hash: rootHash
  };
  outer: for (let part of path.split('/')) {
    if (entry.mode === treeMode) {
      if (!part) continue outer
      for (let child of await loadTree(entry.hash)) {
        if (child.name === part) {
          entry = child
          continue outer
        }
      }
      return {
        status: 404,
        body: `No such entry: ${part}\n`
      };
    }
    return {
      status: 404,
      body: `Not a directory: ${entry.name}\n`
    };
  }

  if (entry.mode === treeMode) {
    if (path[path.length - 1] !== "/") {
      // redirect to add slash
      return {
        status: 302,
        headers: {
          Location: `/${rootName}/${rootHash}${path}/`
        },
        body: "Redirecting...\n"
      };
    }
    let tree = await loadTree(entry.hash);

    // Auto load index.html if found
    for (let child of tree) {
      if (child.name === "index.html" && child.mode !== treeMode) {
        entry = child;
        path = pathJoin(path, "index.html")
        break;
      }
    }

    // Render HTML directory for trees.
    if (entry.mode === treeMode) {
      let html = `<h1>${rootName} - ${path}</h1>`;
      html += "<ul>";
      for (let child of tree) {
        let newPath = pathJoin(path, child.name);
        if (child.mode === treeMode) newPath += "/";
        let href = `/${rootName}/${rootHash}${newPath}`;
        html += `<li><a href="${href}">${child.name}</a></li>`;
      }
      html += "</ul>";
      return {
        headers: { 'Content-Type': 'text/html' },
        body: html
      };
    }
  }

  // Resolve symlinks by redirecting internally to target.
  if (entry.mode === symMode) {
    let target = binToStr(await loadBlob(entry.hash))
    return serve(rootName, rootHash, pathJoin(path, "..", target));
  }

  // Serve files as static content
  // TODO: later we can execute files with exec bit set for virtual server code
  if (entry.mode === blobMode || entry.mode == execMode) {
    let body = await loadBlob(entry.hash)
    return {
      headers: {
        'Content-Type': guess(path, ()=>isUTF8(body)),
        'Content-Disposition': `inline; filename="${entry.name}"`
      },
      body: body
    };
  }

}

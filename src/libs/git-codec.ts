/// <reference path="../typings/js-git.d.ts"/>

import {
  parseOct, parseDec, indexOf, isBin, flatten,
  binToRaw, strToBin, binToStr, hexToBin, binToHex
} from "./bintools"


export let treeMode   = 0o40000;
export let blobMode   = 0o100644;
export let execMode   = 0o100755;
export let symMode    = 0o120000;
export let commitMode = 0o160000;

let modes;
export function getModes() {
  if (modes) return modes;
  return modes = {
    tree:   treeMode,
    blob:   blobMode,
    file:   blobMode,
    exec:   execMode,
    sym:    symMode,
    commit: commitMode
  };
}

export function typeToMode(type : string) : number {
  return getModes()[type];
}

export function modeToType(mode : number) : string {
  return mode === 0o160000 ? "commit"
       : mode === 0o40000 ? "tree"
       : (mode & 0o140000) === 0o100000 ? "blob" : "unknown";
}

export function isBlob(mode : number) : boolean {
  return (mode & 0o140000) === 0o100000;
}

export function isFile(mode : number) : boolean {
  return (mode & 0o160000) === 0o100000;
}

// (body) -> raw-buffer
let encoders;
export function getEncoders() {
  if (encoders) return encoders;
  return encoders = {
    blob: encodeBlob,
    tree: encodeTree,
    commit: encodeCommit,
    tag: encodeTag
  }
}

// (raw-buffer) -> body
let decoders;
export function getDecoders() {
  if (decoders) return decoders;
  return decoders = {
    blob: decodeBlob,
    tree: decodeTree,
    commit: decodeCommit,
    tag: decodeTag
  };
}

export function applyDelata(base, delta) {
  var deltaOffset = 0;

  if (base.length !== readLength()) {
    throw new Error("base length mismatch");
  }

  var outLength = readLength();
  var parts = [];
  while (deltaOffset < delta.length) {
    var b = delta[++deltaOffset];

    if (b & 0x80) {
      // Copy command. Tells us offset in base and length to copy.
      var offset = 0;
      var length = 0;
      if (b & 0x01) { offset |= delta[++deltaOffset]; }
      if (b & 0x02) { offset |= delta[++deltaOffset] << 8; }
      if (b & 0x04) { offset |= delta[++deltaOffset] << 16; }
      if (b & 0x08) { offset |= delta[++deltaOffset] << 24; }
      if (b & 0x10) { length |= delta[++deltaOffset]; }
      if (b & 0x20) { length |= delta[++deltaOffset] << 8; }
      if (b & 0x40) { length |= delta[++deltaOffset] << 16; }
      length = length || 0x10000;
      // copy the data
      parts.push(base.slice(offset, offset + length));
    }
    else if (b > 0) {
      // Insert command, opcode byte is length itself
      parts.push(delta.slice(deltaOffset, deltaOffset + b));
      deltaOffset += b;
    }
    else {
      throw new Error("Invalid opcode in delta");
    }
  }
  var out = flatten(parts);
  if (out.length !== outLength) {
    throw new Error("final size mismatch in delta application");
  }
  return out;

  // Read a variable length number out of delta and move the offset.
  function readLength() {
    deltaOffset++;
    var b = delta[deltaOffset];
    var length = b & 0x7f;
    var shift = 7;
    while ((b & 0x80) > 0) {
      deltaOffset++;
      b = delta[deltaOffset];
      length |= (b & 0x7f) << shift;
      shift += 7;
    }
    return length;
  }

}

export function treeSort(a: GitEntry, b: GitEntry): number {
  let modes = getModes();
  var aa = (a.mode === modes.tree) ? a.name + "/" : a.name;
  var bb = (b.mode === modes.tree) ? b.name + "/" : b.name;
  return aa > bb ? 1 : aa < bb ? -1 : 0;
}

// Remove illegal characters in things like emails and names
function safe(string) {
  return string.replace(/(?:^[\.,:;<>"']+|[\0\n<>]+|[\.,:;<>"']+$)/gm, "");
}

export function encodeBlob(body: GitBlob): Uint8Array {
  if (typeof body === "string") body = strToBin(body);
  if (!isBin(body)) {
    throw new TypeError("Blobs must be binary values");
  }
  return body;
}

export function treeMap(key) {
  /*jshint validthis:true*/
  var entry = this[key];
  return {
    name: key,
    mode: entry.mode,
    hash: entry.hash
  };
}

export function encodeTree(body: GitTree): Uint8Array {
  var tree = [];
  if (!Array.isArray(body)) {
    throw new TypeError("Tree must be in array form");
  }
  body.sort(treeSort);
  for (var i = 0, l = body.length; i < l; i++) {
    var entry : GitEntry = body[i];
    tree.push(entry.mode.toString(8) + " ", strToBin(entry.name), "\0",  hexToBin(entry.hash));
  }
  return flatten(tree);
}

export function encodeTag(body: GitTag): Uint8Array {
  var str = "object " + body.object +
    "\ntype " + body.type +
    "\ntag " + body.tag +
    "\ntagger " + formatPerson(body.tagger) +
    "\n\n" + body.message;
  return strToBin(str);
}

export function encodeCommit(body: GitCommit): Uint8Array {
  var str = "tree " + body.tree;
  for (var i = 0, l = body.parents.length; i < l; ++i) {
    str += "\nparent " + body.parents[i];
  }
  str += "\nauthor " + formatPerson(body.author) +
         "\ncommitter " + formatPerson(body.committer) +
         "\n\n" + body.message;
  return strToBin(str);
}

function formatPerson(person) {
  return safe(person.name) +
    " <" + safe(person.email) + "> " +
    formatDate(person.date);
}

function two(num) {
  return (num < 10 ? "0" : "") + num;
}

function formatDate(date) {
  var seconds, offset;
  if (date.seconds) {
    seconds = date.seconds;
    offset = date.offset;
  }
  // Also accept Date instances
  else {
    seconds = Math.floor(date.getTime() / 1000);
    offset = date.getTimezoneOffset();
  }
  var neg = "+";
  if (offset <= 0) { offset = -offset; }
  else { neg = "-"; }
  offset = neg + two(Math.floor(offset / 60)) + two(offset % 60);
  return seconds + " " + offset;
}

export function decodeBlob(body) {
  return body;
}

export function decodeTree(body) {
  var i = 0;
  var length = body.length;
  var start;
  var mode;
  var name;
  var hash;
  var tree = [];
  while (i < length) {
    start = i;
    i = indexOf(body, " ", start);
    if (i < 0) { throw new SyntaxError("Missing space"); }
    mode = parseOct(body, start, i++);
    start = i;
    i = indexOf(body, "\0", start);
    name = binToStr(body, start, i++);
    hash = binToHex(body, i, i += 20);
    tree.push({
      name: name,
      mode: mode,
      hash: hash
    });
  }
  return tree;
}

export function decodeCommit(body) {
  var i = 0;
  var start;
  var key;
  var parents = [];
  var commit : GitCommit = {
    parents: parents,
  } as GitCommit;
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, " ", start);
    if (i < 0) { throw new SyntaxError("Missing space"); }
    key = binToRaw(body, start, i++);
    start = i;
    i = indexOf(body, "\n", start);
    if (i < 0) { throw new SyntaxError("Missing linefeed"); }
    let value : any = binToStr(body, start, i++);
    if (key === "parent") {
      parents.push(value);
    }
    else {
      if (key === "author" || key === "committer") {
        value = decodePerson(value);
      }
      commit[key] = value;
    }
  }
  i++;
  commit.message = binToStr(body, i, body.length);
  return commit;
}

export function decodeTag(body) {
  var i = 0;
  var start;
  var key;
  var tag : GitTag = {} as GitTag
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, " ", start);
    if (i < 0) { throw new SyntaxError("Missing space"); }
    key = binToRaw(body, start, i++);
    start = i;
    i = indexOf(body, "\n", start);
    if (i < 0) { throw new SyntaxError("Missing linefeed"); }
    var value : any = binToStr(body, start, i++);
    if (key === "tagger") { value = decodePerson(value); }
    tag[key] = value;
  }
  i++;
  tag.message = binToStr(body, i, body.length);
  return tag;
}

function decodePerson(string) {
  var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
  if (!match) { throw new Error("Improperly formatted person string"); }
  return {
    name: match[1],
    email: match[2],
    date: {
      seconds: parseInt(match[3], 10),
      offset: parseInt(match[4], 10) / 100 * -60
    }
  };
}

export function deframeAny(buffer: Uint8Array): GitTag | GitCommit | GitTree | Uint8Array {
  let out = deframePlain(buffer);
  out[1] = getDecoders()[out[0]](out[1]);
  return out;
}

export function deframeBlob(buffer: Uint8Array): Uint8Array {
  let out = deframePlain(buffer);
  if (out[0] !== 'blob') throw new TypeError("Buffer is not a blob");
  return out[1];
}

export function deframeTree(buffer: Uint8Array): GitTree {
  let out = deframePlain(buffer);
  if (out[0] !== 'tree') throw new TypeError("Buffer is not a tree");
  return decodeTree(out[1]);
}

export function deframeCommit(buffer: Uint8Array): GitCommit {
  let out = deframePlain(buffer);
  if (out[0] !== 'commit') throw new TypeError("Buffer is not a commit");
  return decodeCommit(out[1]);
}

export function deframeTag(buffer: Uint8Array): GitTag {
  let out = deframePlain(buffer);
  if (out[0] !== 'tag') throw new TypeError("Buffer is not a tag");
  return decodeTag(out[1]);
}

export function deframePlain(buffer) {
  var space = indexOf(buffer, " ");
  if (space < 0) { throw new Error("Invalid git object buffer"); }
  var nil = indexOf(buffer, "\0", space);
  if (nil < 0) { throw new Error("Invalid git object buffer"); }
  var body = buffer.slice(nil + 1);
  var size = parseDec(buffer, space + 1, nil);
  if (size !== body.length) { throw new Error("Invalid body length."); }
  var type = binToRaw(buffer, 0, space);
  return [type, body];
}

export function frameAny(type, body) {
  return framePlain(type, getEncoders()[type](body));
}

export function frameBlob(body: GitBlob) {
  return framePlain("blob", encodeBlob(body));
}

export function frameTree(body: GitTree) {
  return framePlain("tree", encodeTree(body));
}

export function frameCommit(body: GitCommit) {
  return framePlain("commit", encodeCommit(body));
}

export function frameTag(body: GitTag) {
  return framePlain("tag", encodeTag(body));
}

export function framePlain(type: string, body: Uint8Array): Uint8Array {
  return flatten([
    type + " " + body.length + "\0",
    body
  ]);
}

import { sha1 } from "./sha1"
import { assert } from "./assert"
import { addInspect } from "./bintools";

export function test() {
  addInspect();
  let bin : Uint8Array = frameCommit({
    tree: "0d1e7b7d91995b7ec7f2861e22c45b5f75484a16",
    parents: ["87bf1e51199b64bf814002b3389b8aa1810c2044"],
    author: {
      name: "Tim Caswell",
      email: "tim@creationix.com",
      date: {
        seconds: 1473188682,
        offset: 5*60
      }
    },
    committer: {
      name: "Tim Caswell",
      email: "tim@creationix.com",
      date: {
        seconds: 1473188682,
        offset: 5*60
      }
    },
    message: "Make mime guessing smarter\n"
  });
  console.log(bin)
  let hash : string = sha1(bin);
  console.log(hash);
  let obj : any = deframeCommit(bin);
  console.log(obj);
  assert(hash === '2820bb06ff404c0c54f537617cfe0785f4beac52');

  bin = frameTree([
    {mode: 0o100644, hash: "bda961d855586c7b1fb23d8670564de75a4f8a14", name: ".eslintrc"},
    {mode: 0o100644, hash: "c8496abdeff42fcdf480bcb3a0dc47b868a76a4c", name: ".gitignore"},
    {mode: 0o100644, hash: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391", name: ".gitmodules"},
    {mode: 0o100644, hash: "1f7ed3a68bf50c7ccd493bdfe7cc6e02af4d6bc5", name: "Makefile"},
    {mode: 0o040000, hash: "0c13cd2a1e2a99bb8588055ac8aeededd28f6617", name: "doc"},
    {mode: 0o100644, hash: "dca503d884eae43dbc8fff6e87680f20a6cbe2d5", name: "rollup.download.config.js"},
    {mode: 0o100644, hash: "c79d89eb7c4a7999d73939a48e7a6850a6966154", name: "rollup.github.config.js"},
    {mode: 0o100644, hash: "07ffac227910dad7a1124dc461010adec0ef7c25", name: "rollup.main.config.js"},
    {mode: 0o100644, hash: "295696f6c2356a9ed5b92bb555ca84d457ebd35d", name: "rollup.server.config.js"},
    {mode: 0o100644, hash: "f1d51539f7c0e596fbc829dd57d31777bf7478cb", name: "rollup.upload.config.js"},
    {mode: 0o100644, hash: "39e2e7b2f353860beed15dcc8f551b549f34e982", name: "rollup.worker.config.js"},
    {mode: 0o040000, hash: "22a45bd856aa57983e19510910ad3f267213fcc3", name: "src"},
    {mode: 0o040000, hash: "0d0096d9a210ca51468305243973e5579066013a", name: "www"}
  ]);
  console.log(bin);
  hash = sha1(bin);
  console.log(hash);
  obj = deframeTree(bin);
  console.log(obj);
  assert(hash === '0d1e7b7d91995b7ec7f2861e22c45b5f75484a16');

  bin = frameBlob(`{
  "extends": "eslint:recommended",
  "env": {
    "es6": true,
    "browser": true
  },
  "parserOptions": {
    "sourceType": "module",
  },
  "rules": {
    "no-console": 0
  }
}
`);
  console.log(bin);
  hash = sha1(bin);
  console.log(hash);
  obj = deframeBlob(bin);
  console.log(obj);
  assert(hash === 'bda961d855586c7b1fb23d8670564de75a4f8a14');
}
// test();

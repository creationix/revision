import {
  parseOct, parseDec, indexOf, isBin, flatten,
  binToRaw, strToBin, binToStr, hexToBin, binToHex
} from "./bintools"

let modes;
export function getModes() {
  if (modes) return modes;
  return modes = {
    tree:   0o40000,
    blob:   0o100644,
    file:   0o100644,
    exec:   0o100755,
    sym:    0o120000,
    commit: 0o160000
  };
}

export function typeToMode(type) {
  return getModes()[type];
}

export function modeToType(mode) {
  return mode === 0o160000 ? "commit"
       : mode === 0o40000 ? "tree"
       : mode & 0o140000 === 0o100000 ? "blob" : "unknown";
}

export function isBlob(mode) {
  return mode & 0o140000 === 0o100000;
}

export function isFile(mode) {
  return mode & 0o160000 === 0o100000;
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
    while (b & 0x80 > 0) {
      deltaOffset++;
      b = delta[deltaOffset];
      length |= (b & 0x7f) << shift;
      shift += 7;
    }
    return length;
  }

}

export function treeSort(a, b) {
  let modes = getModes();
  var aa = (a.mode === modes.tree) ? a.name + "/" : a.name;
  var bb = (b.mode === modes.tree) ? b.name + "/" : b.name;
  return aa > bb ? 1 : aa < bb ? -1 : 0;
}

// Remove illegal characters in things like emails and names
function safe(string) {
  return string.replace(/(?:^[\.,:;<>"']+|[\0\n<>]+|[\.,:;<>"']+$)/gm, "");
}

export function encodeBlob(body) {
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

export function encodeTree(body) {
  var tree = [];
  if (!Array.isArray(body)) {
    throw new TypeError("Tree must be in array form");
  }
  body.sort(treeSort);
  for (var i = 0, l = body.length; i < l; i++) {
    var entry = body[i];
    tree.push(entry.mode.toString(8) + " ", strToBin(entry.name), "\0",  hexToBin(entry.hash));
  }
  return flatten(tree);
}

export function encodeTag(body) {
  var str = "object " + body.object +
    "\ntype " + body.type +
    "\ntag " + body.tag +
    "\ntagger " + formatPerson(body.tagger) +
    "\n\n" + body.message;
  return strToBin(str);
}

export function encodeCommit(body) {
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
  var commit = {
    tree: "",
    parents: parents,
    author: "",
    committer: "",
    message: ""
  };
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, " ", start);
    if (i < 0) { throw new SyntaxError("Missing space"); }
    key = binToRaw(body, start, i++);
    start = i;
    i = indexOf(body, "\n", start);
    if (i < 0) { throw new SyntaxError("Missing linefeed"); }
    var value = binToStr(body, start, i++);
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
  var tag = {};
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, " ", start);
    if (i < 0) { throw new SyntaxError("Missing space"); }
    key = binToRaw(body, start, i++);
    start = i;
    i = indexOf(body, "\n", start);
    if (i < 0) { throw new SyntaxError("Missing linefeed"); }
    var value = binToStr(body, start, i++);
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

export function deframeAny(buffer) {
  let out = deframePlain(buffer);
  out[1] = getDecoders()[out[0]](out[1]);
  return out;
}

export function deframeBlob(buffer) {
  let out = deframePlain(buffer);
  if (out[0] !== 'blob') throw new TypeError("Buffer is not a blob");
  return out[1];
}

export function deframeTree(buffer) {
  let out = deframePlain(buffer);
  if (out[0] !== 'tree') throw new TypeError("Buffer is not a tree");
  return decodeTree(out[1]);
}

export function deframeCommit(buffer) {
  let out = deframePlain(buffer);
  if (out[0] !== 'commit') throw new TypeError("Buffer is not a commit");
  return decodeCommit(out[1]);
}

export function deframeTag(buffer) {
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

export function frameBlob(body) {
  return framePlain("blob", encodeBlob(body));
}

export function frameTree(body) {
  return framePlain("tree", encodeTree(body));
}

export function frameCommit(body) {
  return framePlain("commit", encodeCommit(body));
}

export function frameTag(body) {
  return framePlain("tag", encodeTag(body));
}

export function framePlain(type, body) {
  return flatten([
    type + " " + body.length + "\0",
    body
  ]);
}

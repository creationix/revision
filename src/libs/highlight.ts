interface Lexer {
  (input: string): number,
  format?: (text: string) => any,
  skip?: boolean
}

interface Token {
  type: Lexer
  data: string
}

function Literal(s) : Lexer {
  return buffer => buffer[0] === s ? 1 : 0
}

function Pattern(r) : Lexer {
  let source = r.source;
  if (source[0] !== '^')
  r = new RegExp("^" + source, r.flags);
  return buffer => {
    let match = buffer.match(r);
    return match ? match[0].length : 0;
  }
}

let LCurly = Literal('{');
let RCurly = Literal('}');
let Integer = Pattern(/(0|-?[1-9][0-9]*)/);
Integer.format = parseInt;
let Whitespace = Pattern(/\s+/);
Whitespace.skip = true;

let lexers = [LCurly, RCurly, Integer, Whitespace]

function lex(input: string, lexers: Lexer[]) : Token[] {
  let tokens: Token[] = [];
  outer: while (input) {
    for (let lex of lexers) {
      let o = lex(input);
      if (!o) continue;
      if (!lex.skip) {
        let data = input.substr(0, o)
        if (lex.format) data = lex.format(data)
        tokens.push({ type: lex, data: data })
      }
      input = input.substr(o);
      continue outer
    }
    throw new Error("Unexpected text: " + input);
  }
  return tokens;
}

console.log(lex("1 2 { 3 4 } 4 2", lexers))

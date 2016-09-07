// lua-style assert helper
export function assert(val : any, message? : string) : any {
  if (!val) throw new Error(message || "Assertion Failed")
  return val
}

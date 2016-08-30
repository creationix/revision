// lua-style assert helper
export function assert(val, message) {
  if (!val) throw new Error(message || "Assertion Failed");
}


// Usage: async(function* (...args) { yield promise... })(..args) -> Promise
export function async(gen) {
  return function (...args) {
    return run(gen(...args));
  };
}
// Usage: run(iter) -> Promise
export function run(iter) {
  try { return handle(iter.next()); }
  catch (ex) { return Promise.reject(ex); }
  function handle(result){
    if (result.done) return Promise.resolve(result.value);
    return Promise.resolve(result.value).then(function (res) {
      return handle(iter.next(res));
    }).catch(function (err) {
      return handle(iter.throw(err));
    });
  }
}

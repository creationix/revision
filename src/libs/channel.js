
// This implements a basic channel where independent coroutines can produce and
// consume values.  The maxBuffer value is the maximum number of unread values
// to buffer before blocking the writer. Since both functions may return a
// promise, consumers of This should use Promise.resolve.
export function newChannel(maxBuffer) {
  let queue = {};
  let reader = 0;
  let writer = 0;
  maxBuffer |= 0;
  let closing = false;

  return { read, write, close, get length() {
    return writer - reader;
  }};

  function close() {
    // Mark channel as closing
    if (closing) return;
    closing = true;

    // If there are pending writes, wait for them.
    if (writer > reader) {
      return new Promise((resolve) => {
        resolve();
        return;
      });
    }

    // If there are pending readers, tell them we're done.
    while (reader > writer) {
      queue[writer++]();
    }
  }

  function read() {
    // If there is a waiting value, consume it.
    if (writer > reader) {
      return queue[reader++]();
    }

    // If it's closing or closed, we can just return.
    if (closing) return;

    // Otherwise wait for a value
    return new Promise((resolve) => {
      queue[reader++] = resolve;
    });
  }

  function write(value) {
    if (closed) throw new Error("Channel closing or closed");
    // If there is a waiting reader, give it the value!
    if (reader > writer) {
      return queue[writer++](value);
    }

    // If there is room on the buffer, store the value and move on.
    if (writer < reader + maxBuffer) {
      queue[writer++] = () => value;
      return;
    }

    // Otherwise wait for a reader before resuming.
    return new Promise((resolve) => {
      queue[writer++] = () => {
        resolve();
        return value;
      };
    });
  }
}

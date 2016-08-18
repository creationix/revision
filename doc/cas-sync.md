
There are two node types, object and blob.

A blob is raw data and cannot contain links to other values.

An object is a msgpack value with links being encoded as extension type 127 in
binary. This leaves a rich JSON-like structure that also has 127 application
defined extension types that are binary safe.

Also the first byte of the payload is the type.  Zero is blob and cannot
contain.

Downloading content is simple.

Given a hash, perform the following algorithm.

 1. Check the local cache in the client.  If it's there, skip to 3
 2. Request the body from the server by hash, cache it locally.
 3. If the body is a tree node, scan for children recursively

Uploading is fairly simple, but we don't know what the server has already.

 1. Send a tree node
 2. Server will respond with `done:hash` to confirm
 3. If server lacks any of the referenced hashes, it will send `want:hash` messages
 4. Send bodies for request wants.

You *can* send bodies that weren't asked for if you know they will be asked for
to eliminate round-trip latency.  For example, if a file in a deep directory
structure was changed, it's highly likely that all the direct parent tree nodes
are also required.  In this case, ignore the `want:hash` request if you just
preemptively sent the body.

want hash -> body
want hashes -> bodies
send-tree tree -> hash
  -> wants

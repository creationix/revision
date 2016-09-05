
## Upload Sync

- binary message is upload, no response needed.

- s:hash is up-sync query.  Respond with zero or more w:hash commands to request
  further uploads.  Send d:hash once hash and all dependencies are stored.

An initial upload looks like:

```
Client: s 1234
Server: w 1234
Client: [binary for 1234]
Server: w 4123
        w 2543
Client: [binary for 4123]
        [binary for 2543]
Server: d 1234
```

Once the file is already cached, it will look like:

```
Client: s 1234
Server: d 1234
```

Also if there was a partial upload and entries are missing, they will be synced

If for some reason, the client is unable or unwilling to send certain objects,
it can send m:hash in place of the message data.

## Download Sync

Download is simple, the client simply sends w:hash commands.
If the server has the value it sends it as binary, if not, it sends m:hash.
This is basically the inner part of an upload sync, but reversed.

```
Client: w 1234
Server: [binary for 1234]
Client: w 4123
Client: w 2543
Server: [binary for 4123]
        [binary for 2543]
```

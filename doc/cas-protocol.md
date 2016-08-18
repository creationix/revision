This is a super simple protocol that works over websockets or plain HTTP.  There
are two commands, save and load.

To save, you give the server a binary blob and it gives you back a key.   To
load, you give it the key and it gives you the blob.  

## Content Addressable Key Properties

The keys are guaranteed to be consistent hashes of the data itself (hence the
Content Addressable Storage part of the name). This means the client can make a
couple assumptions:

 - The data for a given key is immutable.  This makes caching very simple, you
   never have to check for updates for a given key.

 - Duplicate data will always result in the same key, you can store duplicate
   data without additional cost.

## Transports

When going over websockets, the subprotocol is simply "cas-sync".  
To issue a load command, simply send a text frame with the hash in hex form, the body will come back as a binary frame.
To issue a save command, simply send the body as a binary frame.  The key will come back in text form.

These messages can be pipelined, you can send 10 key frames without waiting for a response and then get back the
10 response bodies in order.

The HTTP version is simple as well (well for HTTP).

Reading is a simple `GET /$hash`.  The response is the binary value.
Writing is done with either `PUT /$hash` or `POST /`.  In the put case, it will refuse the upload if the actual data hash
doesn't match the one in the url.  PUT will respond with 201, POST will also respond with 201, but will include a Location header with the hash.

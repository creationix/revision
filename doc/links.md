# Data Shapes

The core data structure of Revision Studio is a global distributed content
addressable graph where every node contains schema-less structured data.

Here we will design a couple schema conventions for mapping a git compatible
file system on top of this graph.

## Tree Type

The tree type represents a filesystem directory.  It can point to other trees or
files.  If we want to be git compatible, we need at a minimum, filename, link,
and  file type (normal, executable, symlink, tree, or commit).  

The commit type part is for submodules which might be interesting to map to this
global graph design.

Type is an integer enum:

  -TREE=0
  -NORMAL_FILE=1
  -EXECUTABLE_FILE=2
  -SYMBOLIC_LINK=3
  -SUBMODULE=4?

```js
// Shape of a tree
{
  tree: [ // Compact representation of file entries
    [type, filename, link],
    ...
  ],
  ... // Room for extra metadata
}
```

## File Type

The file type is easy.  In git it's nothing more than the blob.  We leave room
for extra metadata in our model.

The metadata allows us to store extra things like mime-type (for serving over
http) or interpreter (for running code in the server).

```js
// Shape of a file
{
  file: buffer
  ... // Room for extra metadata
}
```

## Release Type

A release is roughly analogous to a git commit and/or tag.  It points to a tree
or file and contains metadata about the release such as the author, when it was
made, their digital signature, homepage and parent releases, etc.

```js
// Shape of release
{
  root: Link,
  name: String,
  ... // extra metadata
}
```

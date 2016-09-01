```js

// uuid
`${Date.now().toString(16)}-${require('crypto').randomBytes(20).toString("hex")}`

// Project (mutable, keyed by uuid)
title: String,
members: Link<Project>* // Links to projects that belong to this profile
organizations: Link<Project>* // Links to projects that this belongs to
peers: Link<Project>* // Links to peer projects
state: Link<Revision>


// Revision (immutable, keyed by hash of contents)
author: SymLink<Project> // link to profile of person making this change
message: String // changelog in this revision.
date: Date
parents: Link<Revision>* // history of changes
root: Link<Tree> // Link to the root tree for this project

// Tree (immutable, keyed by hash of contents)
{
  $name: [value, type?]
  folder: [Link<Tree>]
  file: [Link<Data>]
  symlink: [String]
  ...
}

// Data  (immutable, keyed by hash of contents)
Uint8Array




```

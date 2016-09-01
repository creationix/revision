# Data Models

Within the Revision Studio system there are several data models that are
represented with a mix of immutable content-addressable graphs and mutable
revision-pointers (think git branches/heads).

## SymLink vs Link

All objects in this system are stored as content-addressable blocks.  A `Link`
is literally nothing more than the SHA1 hash of the content encoded as a
extension type so it can be identified apart from 20-byte binary blobs.  Being
content-addressable, the value a link points to is immutable by it's very
definition.  Thus no authentication is required to publish such objects as you
can only add new content and never modify anything existing. Perhaps some
general quota limits might be added to mitigate against abuse.

A `SymLink` on the other hand, is mutable.  This allows for immutable data
structures to point to a changing value indirectly.  The SymLink itself is
simply a URI that contains the current `Link` address.

The Revision Studio service will host `rs:${uuid}` style SymLinks. Their
internal structure will look like:

```js
link: Link
owners: Object
  String<Email|GithubUsername>: Bool<Admin>+
```

Where `owners` is a map of identity to administrator status.  Everyone
listed in the owners has write access to the link target, but only
administrators can modify the owners map.  They can change anything including
adding or removing owners.

Github usernames are authenticated via oauth tokens.  Email address will be done
via email links that set browser cookies.  These cookies need to be sent along
with the websocket connection to the Revision Studio endpoint to be
authenticated.

Other protocols could be supported such as http(s) urls that return the link
hash in plain text followed by a newline.  Data after this would be ignored.
(Example: `https://creationix.com/revision`)

## Profile Model

The first model is the profile of an author.  This will contain things like
name, social media profiles, websites, email, bio., photo, etc.

Profiles can also be used for organizations of things. They may be a company, a
set of bookmarks on some topic, a set of libraries for a framework, etc.

It will also contain revision-pointers to `Project`s and other `Profiles`s that
are associated with this profile.  They will also have a revision-pointer to
themselves so you can discover the latest version given any older version.

```js
// Profile
uuid: UUID
name: String
email: String
type: (organization|individual)
header.png: Link<Data>
pic.png: Link<Data>
bio: String
twitter: String
github: String
homepage: String
projects: [SymLink<Project>*]
peers: [SymLink<Profile>*] // Used by either
organizations: [SymLink<Profile>*] // Used by individuals or sub organizations
members: [SymLink<Profile>*] // Used by organizations
```

## Project Model

A Project represents an actual filesystem and revision history.

The root `Project` object needs to be small since a new version is created
every time a new snapshot is published in any of it's branches or the metadata
is updated.  The roots work somewhat like branches in git.

```js
// Project
uuid: UUID
meta: Link<ProjectMeta>
roots: Object
  $name: Link<Snapshot>
  ...

// ProjectMeta
name: String
description: String
readme: String
members: [SymLink<Profile>*]
...

// Snapshot
date: Date
message: String
author: Link<Profile>
parents: [Link<Snapshot>*]
meta: Link<Meta>
tree: Object
  folderName: Object
    subFolder: Object
      filename: Link<Data>
      symlink: String
```

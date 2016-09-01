# Data Models

Within the Revision Studio system there are several data models that are
represented with a mix of immutable content-addressable graphs and mutable
revision-pointers (think git branches/heads).

A revision-pointer is essentially a random uuid (key) that points to a
content-addressable hash location (value) that can be updated.  It's meaning is
defined by whatever it points to and whatever points to it.

## Profile Model

The first model is the profile of an author.  This will contain things like
name, social media profiles, websites, email, bio., photo, etc.

Profiles can also be used for organizations of things. They may be a company, a
set of bookmarks on some topic, a set of libraries for a framework, etc.

It will also contain revision-pointers to `Project`s and other `Profiles`s that
are associated with this profile.  They will also have a revision-pointer to
themselves so you can discover the latest version given any older version.

## Project Model

A Project represents an actual filesystem and revision history.
- Project Snapshot - points to project meta
  to project metadata; also contains change description, date, committer.
  - Meta - contains information about project (name, author,
    description, etc.) Includes uuid of organizations
  - File - contains file data



## Tree and File

The `Tree` type contains a full tree listing for a project at a given snapshot
in time.  It will contain links to `File` types.

## Revisions

 - UUIDs are used for mutable state.  They always point to just a hash and
   represent an anonymous updating pointer.
 - Organizations have UUIDs so that you can find the official latest version.
 - Profiles have UUIDs and point to organizations by UUID

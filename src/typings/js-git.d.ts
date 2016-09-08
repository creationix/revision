interface GitDate {
  seconds: number,
  offset: number
}

interface GitPerson {
  name: string,
  email: string,
  data: GitDate
}

interface GitTag {
  object: string,
  type: string,
  tag: string,
  tagger: GitPerson,
  message: string
}

interface GitCommit {
  tree: string,
  parents: string[],
  author: GitPerson,
  committer: GitPerson,
  message: string
}

interface GitEntry {
  mode: number,
  name: string,
  hash: string
}

type GitTree = GitEntry[]
type GitBlob = Uint8Array

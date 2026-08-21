type Nsid = `${string}.${string}`
type RepoAction = "create" | "update" | "delete"
type RepoActionSequence<
  Available extends RepoAction = RepoAction,
  Choice extends Available = Available,
> = Choice extends Available
  ?
      | Choice
      | ([Exclude<Available, Choice>] extends [never]
          ? never
          : `${Choice}&action=${RepoActionSequence<Exclude<Available, Choice>>}`)
  : never
type AccountAttribute = "email" | "repo"
type AccountAction = "read" | "manage"
type MimeType = `${string}/${string}`
type DidService = `did:${string}%23${string}`

type RepoScope = `repo:${Nsid | "*"}` | `repo:${Nsid | "*"}?action=${RepoActionSequence}`

type RpcScope =
  | `rpc:${Nsid | "*"}?aud=${DidService | "*"}`
  | `rpc?lxm=${Nsid | "*"}&aud=${DidService | "*"}`

type BlobScope = `blob:${MimeType}`
type AccountScope =
  | `account:${AccountAttribute}`
  | `account:${AccountAttribute}?action=${AccountAction}`
type IdentityScope = `identity:${"handle" | "*"}`
type IncludeScope = `include:${Nsid}` | `include:${Nsid}?aud=${DidService}`

/** An AT Protocol OAuth scope from the current permissions specification. */
export type AtprotoOAuthScope =
  | "atproto"
  | RepoScope
  | RpcScope
  | BlobScope
  | AccountScope
  | IdentityScope
  | IncludeScope

// Route params (e.g. Next.js dynamic [id] segments) arrive as plain
// strings — nothing stops a caller from passing a room_code ("B3E5C4")
// where a room UUID is expected. Validating the shape before it ever
// reaches a uuid-typed Postgres column turns a silent/misleading 403
// ("not a member") into an explicit 400 ("bad id") — confirmed against a
// real production incident where a room_code hit /turn-credentials and
// was indistinguishable from a genuine authorization failure.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

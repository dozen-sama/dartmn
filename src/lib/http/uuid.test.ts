import { test } from "node:test"
import assert from "node:assert/strict"
import { isUuid } from "./uuid.ts"

// G: a room_code sent where a UUID is expected must be rejected before it
// ever reaches a uuid-typed Postgres column (the production incident this
// guards against — /turn-credentials/B3E5C4 falling through to a 403).
test("room_code-shaped id is rejected", () => {
  assert.equal(isUuid("B3E5C4"), false)
})

test("empty string is rejected", () => {
  assert.equal(isUuid(""), false)
})

test("uuid missing a segment is rejected", () => {
  assert.equal(isUuid("6ddc940b-ca46-4f0d-88f4"), false)
})

// H: a real UUID is accepted and can proceed to membership authorization.
test("valid lowercase uuid v4 is accepted", () => {
  assert.equal(isUuid("6ddc940b-ca46-4f0d-88f4-5c5a9464bac0"), true)
})

test("valid uppercase uuid is accepted", () => {
  assert.equal(isUuid("6DDC940B-CA46-4F0D-88F4-5C5A9464BAC0"), true)
})

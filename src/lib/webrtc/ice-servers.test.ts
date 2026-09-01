// Node built-in test runner ашиглана (`node --test`) — репод тестийн
// framework алга тул шинээр нэмээгүй, зөвхөн энэ pure validation логикийг
// баталгаажуулна.
import { test } from "node:test"
import assert from "node:assert/strict"
import { isValidIceServers, GOOGLE_STUN_FALLBACK } from "./ice-servers.ts"

test("valid Cloudflare-shaped response (string urls) passes", () => {
  assert.equal(isValidIceServers([
    { urls: ["stun:stun.cloudflare.com:3478"] },
    { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "u", credential: "c" },
  ]), true)
})

test("valid response with a single string url passes", () => {
  assert.equal(isValidIceServers([{ urls: "stun:stun.l.google.com:19302" }]), true)
})

test("non-array value fails", () => {
  assert.equal(isValidIceServers(undefined), false)
  assert.equal(isValidIceServers(null), false)
  assert.equal(isValidIceServers({ iceServers: [] }), false)
})

test("empty array fails", () => {
  assert.equal(isValidIceServers([]), false)
})

test("entry missing urls fails", () => {
  assert.equal(isValidIceServers([{ username: "u", credential: "c" }]), false)
})

test("entry with empty urls array fails", () => {
  assert.equal(isValidIceServers([{ urls: [] }]), false)
})

test("entry with empty string url fails", () => {
  assert.equal(isValidIceServers([{ urls: "" }]), false)
})

test("entry with non-string url in array fails", () => {
  assert.equal(isValidIceServers([{ urls: [123] }]), false)
})

test("one malformed entry among valid ones fails the whole batch", () => {
  assert.equal(isValidIceServers([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: [] },
  ]), false)
})

test("GOOGLE_STUN_FALLBACK itself is always valid", () => {
  assert.equal(isValidIceServers(GOOGLE_STUN_FALLBACK), true)
})

// Node built-in test runner ашиглана (`node --test`) — репод тестийн
// framework алга тул шинээр нэмээгүй, зөвхөн энэ pure collision логикийг
// баталгаажуулна.
import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveIncomingOffer } from "./offer-collision.ts"

test("stable state + incoming offer -> accept", () => {
  assert.equal(resolveIncomingOffer("stable", "aaa", "bbb"), "accept")
  assert.equal(resolveIncomingOffer("stable", "zzz", "aaa"), "accept")
})

test("have-local-offer + polite peer (smaller id) -> rollback-then-accept", () => {
  assert.equal(resolveIncomingOffer("have-local-offer", "aaa", "bbb"), "rollback-then-accept")
})

test("have-local-offer + impolite peer (larger id) -> ignore", () => {
  assert.equal(resolveIncomingOffer("have-local-offer", "bbb", "aaa"), "ignore")
})

test("both peers compute complementary polite/impolite roles from the same two ids", () => {
  const pairs: [string, string][] = [
    ["a1", "b2"],
    ["user-123", "user-456"],
    ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"],
    ["zeta", "alpha"],
  ]
  for (const [x, y] of pairs) {
    const xView = resolveIncomingOffer("have-local-offer", x, y)
    const yView = resolveIncomingOffer("have-local-offer", y, x)
    // Яг НЭГ тал rollback хийж хүлээн авах ёстой, нөгөө тал үл тоох ёстой —
    // хэзээ ч хоёулаа rollback хийх, эсвэл хоёулаа ignore хийх ёсгүй.
    const actions = [xView, yView].sort()
    assert.deepEqual(actions, ["ignore", "rollback-then-accept"])
  }
})

test("have-remote-offer (not a genuine local-offer collision) always ignores, regardless of id ordering", () => {
  // Энэ hook-ийн бодит дуудлагын замд хэзээ ч хүрдэггүй төлөв (peer бүр
  // session тутамд ганц л offer явуулдаг) — санамсаргүй давхардсан broadcast
  // ирвэл polite/impolite id харьцуулалтгүйгээр зүгээр л үл тоох ёстой,
  // "have-local-offer" collision-той адилтгаж rollback хийх ёсгүй.
  assert.equal(resolveIncomingOffer("have-remote-offer", "aaa", "bbb"), "ignore")
  assert.equal(resolveIncomingOffer("have-remote-offer", "bbb", "aaa"), "ignore")
})

test("pranswer states (unused by this app, but exhaustive) also fall back to ignore, not id comparison", () => {
  assert.equal(resolveIncomingOffer("have-local-pranswer", "aaa", "bbb"), "ignore")
  assert.equal(resolveIncomingOffer("have-remote-pranswer", "bbb", "aaa"), "ignore")
})

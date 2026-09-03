// Хоёр peer бараг зэрэг offer үүсгэх үед ("glare") аль тал rollback хийж
// ирсэн offer-ыг хүлээж авах, аль тал үүнийг үл тоож өөрийн offer-ийн
// хариуг хүлээхийг тодорхойлно (WebRTC "perfect negotiation" загварын
// polite/impolite аргачлал). Цэвэр функц тул useWebRTCCamera-г бүхэлд нь
// mock хийлгүйгээр unit test-ээр шууд баталгаажуулж болно.
export type OfferCollisionAction = "accept" | "rollback-then-accept" | "ignore"

export function resolveIncomingOffer(
  signalingState: RTCSignalingState,
  myId: string,
  fromId: string,
): OfferCollisionAction {
  if (signalingState === "stable") return "accept"
  if (signalingState === "have-local-offer") {
    // Цорын ганц бодит "collision": би өөрөө offer үүсгээд илгээсэн байх
    // үед нөгөө талаас мөн offer ирлээ — id-гаараа бага тал ("polite")
    // өөрийн offer-оо rollback хийж ирснийг хүлээн авна, том тал
    // ("impolite") ирснийг үл тоож өөрийн offer-ийн хариуг хүлээнэ.
    return myId < fromId ? "rollback-then-accept" : "ignore"
  }
  // Бусад stable бус төлөв (have-remote-offer, have-*-pranswer) энэ hook-ийн
  // бодит дуудлагын замд хэзээ ч хүрдэггүй: peer бүр session тутамд ганц л
  // offer явуулдаг (cam-on handler-аас), pranswer ерөөс ашиглагддаггүй —
  // useWebRTCCamera.ts-ийн "offer" handler-т createPc() ЗААВАЛ "stable"
  // (шинэ pc) эсвэл "have-local-offer" (cam-on handler-аас өөрөө offer
  // илгээсэн) төлөвтэй pc буцаана. Гэсэн ч санамсаргүй давхардсан broadcast
  // (жишээ нь Realtime дахин холбогдоход) ирвэл id харьцуулалт хийхгүйгээр
  // зүгээр л үл тоож, аль хэдийн явж буй хэлэлцээрийг эвдэхгүй байхыг
  // сонгоно — энэ бол polite/impolite алгоритм биш, зүгээр л хамгаалалт.
  return "ignore"
}

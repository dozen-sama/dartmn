// Сүлжээ шилжих (Wi-Fi ↔ cellular) эсвэл түр тасрахад нэг peer connection-г
// камерын stream-д хүрэлгүйгээр сэргээх шийдвэрийн цэвэр логик. useWebRTCCamera.ts
// доторх timer/RTCPeerConnection wiring эндээс тусгаарлагдсан тул jsdom/fake
// browser объектгүйгээр unit test-ээр бүрэн баталгаажуулж болно.

// Хоёр peer-ийн аль нь тухайн холболтын сэргээлтийг санаачлахыг тодорхойлно.
// offer-collision.ts-ийн polite/impolite id-харьцуулалттай ижил "id-гаар
// deterministic шийдэх" зарчим — гэхдээ өөр зорилготой (мөргөлдөөн шийдэх
// биш, ownership assign хийх) тул тусдаа функц.
export function shouldInitiateRecovery(myId: string, remoteId: string): boolean {
  return myId > remoteId
}

// ICE-restart (pc.createOffer({iceRestart:true})) хийх эсэхийг шийднэ. Хоёр
// дуудагдах цэгтэй: (1) "disconnected" grace timer (~3сек) дуусахад, хэвээр
// disconnected байвал; (2) "failed" ирэхэд шууд, grace хүлээхгүйгээр. Аль ч
// тохиолдолд зөвхөн энэ тал сэргээлтийг эзэмшдэг (isInitiator) үед л true.
export function shouldAttemptIceRestart(
  currentIceState: RTCIceConnectionState,
  isInitiator: boolean,
): boolean {
  return (currentIceState === "disconnected" || currentIceState === "failed") && isInitiator
}

// ICE-restart offer илгээгээд bounded хугацаанд хүлээсний дараа хэвээр
// connected/completed болоогүй байвал peer connection-г бүрмөсөн шинээр
// босгох ёстой юу гэдгийг шийднэ.
export function shouldRebuildAfterRecoveryTimeout(currentIceState: RTCIceConnectionState): boolean {
  return currentIceState !== "connected" && currentIceState !== "completed"
}

// Нэг "episode"-д (disconnected/failed → restart → bounded timeout) хамгийн
// ихдээ ГАНЦ л rebuild зөвшөөрнө — endless rebuild loop-оос сэргийлнэ.
// Амжилттай холбогдмогц (connected/completed) дуудагчийн тал rebuildCount-г
// 0 болгож reset хийнэ, ингэснээр ДАРАА нь гарах бүр шинэ episode тооцогдоно.
export function canAttemptRebuild(rebuildCount: number): boolean {
  return rebuildCount < 1
}

// Клиг (play-in) тоглолтын seed-хуваарилалт: N тоглогч 2-ын зэрэгт багтахгүй үед
// (жишээ нь 10) BYE-ийн оронд доод эрэмбийн илүүдэл тоглогчдыг бодит клиг тоглолтоор
// шийдэж, ялагчид нь зорилтот bracket (2-ын доод зэрэг) хэмжээний Round 1-ийг дүүргэнэ.
// Цэвэр функц, seed тоо (1-indexed rank, 1 = хамгийн дээд)-той л ажиллана.

export interface PlayInPlan {
  targetSize: number
  excess: number
  directSeeds: number[]                            // урттай нь targetSize-excess, шууд Round 1-д орно
  playInPairs: [number, number][]                   // [дээд seed, доод seed], индекс i = клиг тоглолт i+1
  // Урт нь targetSize — виртуал seed (1-indexed)-ийн эх сурвалж: тоо бол шууд seed,
  // {playInIndex} бол тухайн индекстэй клиг тоглолтын ялагч.
  virtualSeedSource: (number | { playInIndex: number })[]
}

export function computePlayInPlan(n: number): PlayInPlan {
  let targetSize = 1
  while (targetSize * 2 <= n) targetSize *= 2
  const excess = n - targetSize
  const directCount = targetSize - excess

  const directSeeds = Array.from({ length: directCount }, (_, i) => i + 1)
  const playInPairs: [number, number][] = []
  for (let i = 1; i <= excess; i++) {
    playInPairs.push([directCount + i, n - i + 1])
  }

  const virtualSeedSource: (number | { playInIndex: number })[] = Array.from(
    { length: targetSize },
    (_, idx) => {
      const v = idx + 1
      return v <= directCount ? v : { playInIndex: v - directCount - 1 }
    }
  )

  return { targetSize, excess, directSeeds, playInPairs, virtualSeedSource }
}

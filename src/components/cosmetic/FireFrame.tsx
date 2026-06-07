/**
 * Шатаж буй хүрээ — CSS clip-path галын дөлний эгнээ.
 * Дөл бүр өөр өндөр/хэмнэлээр дүрэлзэж жинхэнэ гал мэт хөдөлнө.
 * Эх элементдээ absolute-аар дээд ирмэг дээгүүр байрлана (.np-fire).
 */
const FLAMES = Array.from({ length: 11 })

export function FireFrame() {
  return (
    <span className="np-fire" aria-hidden="true">
      {FLAMES.map((_, i) => (
        <span key={i} className="np-flame" />
      ))}
    </span>
  )
}

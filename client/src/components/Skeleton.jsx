// Bloques de carga con shimmer, acordes al tema.
// <Skeleton width="60%" height={18} /> | <Skeleton.Lines count={4} /> | <Skeleton.Card lines={3} />
export default function Skeleton({ width = '100%', height = 14, style = {}, className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}

Skeleton.Lines = function Lines({ count = 3, gap = '0.6rem' }) {
  return (
    <div style={{ display: 'grid', gap }} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - i * 12}%`, height: 14 }} />
      ))}
    </div>
  )
}

Skeleton.Card = function Card({ lines = 3, header = true }) {
  return (
    <div className="skeleton-card" aria-hidden="true">
      {header && <div className="skeleton" style={{ width: '45%', height: 20 }} />}
      <Skeleton.Lines count={lines} />
    </div>
  )
}

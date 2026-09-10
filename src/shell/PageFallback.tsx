import { SkeletonAmount, SkeletonRow } from '@/components/Skeleton'

/** Generic page skeleton used while a route chunk loads. */
export function PageFallback() {
  return (
    <div className="page" aria-busy="true" aria-label="Chargement">
      <SkeletonAmount />
      <div style={{ height: 'var(--sp-6)' }} />
      <SkeletonRow count={4} />
    </div>
  )
}

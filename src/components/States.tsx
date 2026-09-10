/**
 * Error + offline states, shared everywhere.
 */
import type { ApiError } from '@/api/types'
import { useOnline } from '@/store/online'
import { Button } from './Button'
import { Icon } from './Icon'
import styles from './States.module.css'
import { cn } from '@/lib/cn'

export function ErrorState({ error, onRetry, compact = false, className }: { error?: ApiError | Error | null; onRetry?: () => void; compact?: boolean; className?: string }) {
  const online = useOnline()
  const offline = !online || (error && 'code' in error && error.code === 'offline')
  const title = offline ? 'Vous êtes hors ligne' : 'Impossible de charger'
  const body = offline ? 'Vérifiez votre connexion. Les dernières données connues restent affichées.' : (error?.message ?? 'Une erreur réseau est survenue.')
  return (
    <div className={cn(styles.error, compact && styles.compact, className)} role="alert">
      <Icon name={offline ? 'wifi-off' : 'cloud-off'} className={styles.icon} />
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{body}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} icon={<Icon name="rotate-cw" size={18} />}>
          Réessayer
        </Button>
      ) : null}
    </div>
  )
}

/** Thin banner shown at the top of the app while offline. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className={styles.banner} role="status">
      <Icon name="wifi-off" size={16} />
      Hors ligne — affichage des dernières données connues
    </div>
  )
}

/** Small inline status for refetching without hiding content. */
export function Refreshing({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <span className={styles.refreshing} aria-live="polite">
      Mise à jour…
    </span>
  )
}

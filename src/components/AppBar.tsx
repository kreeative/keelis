/**
 * The top bar of a primary destination: a round button on each side, the screen's name
 * between them. It exists for a reason beyond symmetry — the notification inbox was
 * reachable only from the desktop rail, so on a phone, where this app lives, /notifications
 * had no entry point at all. The bell is now the first thing on every top-level screen.
 *
 * Sub-pages keep `PageHeader` (back, close, eyebrow); this is only for the destinations
 * the nav itself points at. Hidden from 768px up, where the rail carries the same links.
 */
import { NavLink, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import type { AppNotification } from '@/api/types'
import { QK, useQuery } from '@/store'
import { useSession } from '@/store/session'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { StatusDot } from './StatusDot'
import styles from './AppBar.module.css'

export interface AppBarProps {
  /** The screen's name, or anything short that identifies it. */
  title: string
  /** Sits between the title and the profile button — a screen's own control. */
  actions?: React.ReactNode
  className?: string
}

export function AppBar({ title, actions, className }: AppBarProps) {
  const navigate = useNavigate()
  const { user } = useSession()
  const notifications = useQuery<AppNotification[]>(QK.notifications, () => api.notifications.list(), { staleTime: 30_000 })
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : ''

  return (
    <header className={cn(styles.bar, className)}>
      <NavLink
        to="/notifications"
        className={styles.button}
        aria-label={unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
      >
        <span className={styles.glyph}>
          <Icon name="bell" />
          {unread > 0 ? <StatusDot corner /> : null}
        </span>
      </NavLink>

      <h1 className={styles.title}>{title}</h1>

      <div className={styles.end}>
        {actions}
        <button type="button" className={styles.button} onClick={() => navigate('/profil')} aria-label="Profil et réglages">
          {initials ? (
            <span className={styles.initials} aria-hidden="true">
              {initials}
            </span>
          ) : (
            <Icon name="circle-user-round" />
          )}
        </button>
      </div>
    </header>
  )
}

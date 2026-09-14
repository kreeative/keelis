/**
 * Navigation.
 * - Mobile: bottom bar, 5 tabs with labels.
 * - Desktop (≥768px): narrow icon rail — brand at the top, primary destinations in the
 *   middle, utilities (notifications, theme, profile) at the bottom. Labels appear as
 *   tooltips on hover/focus; every control keeps an aria-label and a 44px target.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useSession, useSettings } from '@/store'
import { Icon, type IconName } from './Icon'
import { StatusDot } from './StatusDot'
import { Wordmark } from './Wordmark'
import styles from './NavBar.module.css'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end: boolean
}

/** Mobile bottom bar — 5 tabs, as specified. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Accueil', icon: 'house', end: true },
  { to: '/crypto', label: 'Actifs', icon: 'chart-line', end: false },
  { to: '/carte', label: 'Carte', icon: 'credit-card', end: false },
  { to: '/epargne', label: 'Épargne', icon: 'piggy-bank', end: false },
  { to: '/profil', label: 'Profil', icon: 'circle-user-round', end: false },
]

/** Desktop rail — the same destinations plus Activité, which has its own entry there. */
const RAIL_ITEMS: readonly NavItem[] = [
  /* Search leads the rail, as it does in the reference: on a desktop the first thing you
     reach for is the thing you cannot see. */
  { to: '/crypto', label: 'Rechercher un actif', icon: 'search', end: true },
  { to: '/', label: 'Accueil', icon: 'house', end: true },
  { to: '/crypto', label: 'Actifs', icon: 'chart-line', end: false },
  { to: '/carte', label: 'Carte', icon: 'credit-card', end: false },
  { to: '/epargne', label: 'Épargne', icon: 'piggy-bank', end: false },
  { to: '/activite', label: 'Activité', icon: 'clock', end: false },
]

function RailLink({ item, badge }: { item: NavItem; badge?: boolean }) {
  return (
    <li>
      <NavLink to={item.to} end={item.end} className={({ isActive }) => cn(styles.railLink, isActive && styles.railActive)} aria-label={item.label}>
        <span className={styles.railIcon}>
          <Icon name={item.icon} />
          {badge ? <StatusDot corner /> : null}
        </span>
        <span className={styles.tip} aria-hidden="true">
          {item.label}
        </span>
      </NavLink>
    </li>
  )
}

/**
 * Where the gold capsule sits, in the pill's own coordinates.
 *
 * It used to be a background on whichever link was active, which meant that changing tab
 * cross-faded two gold blobs through each other — for a third of a second there were two
 * lit destinations, and then there was one. A capsule that *moves* is both truer (there is
 * one active destination, and it went somewhere) and the single most recognisable piece of
 * motion in an iOS tab bar. It is measured rather than computed from the index, because the
 * links are not all the same width below 360px.
 */
function useActiveCapsule(deps: unknown) {
  const list = useRef<HTMLUListElement>(null)
  const [at, setAt] = useState<{ x: number; w: number } | null>(null)

  const measure = () => {
    const root = list.current
    if (!root) return
    /* The <li>, not the <a> inside it. The item is `position: relative` so it can sit
       above the capsule, which makes it the link's own `offsetParent` — so the link's
       `offsetLeft` is 0 on every tab, and the capsule sat under the first one for ever.
       Measured, caught, and this is the line that was wrong. */
    const active = root.querySelector<HTMLElement>('[aria-current="page"]')?.closest('li')
    /* Null on a screen no tab owns — /notifications, a transaction detail. No capsule is
       the honest answer there; parking it under a tab you are not on is not. */
    setAt(active instanceof HTMLElement ? { x: active.offsetLeft, w: active.offsetWidth } : null)
  }

  useLayoutEffect(measure, [deps])
  useEffect(() => {
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (list.current && ro) ro.observe(list.current)
    return () => ro?.disconnect()
  }, [])

  return { list, at }
}

export function NavBar({ unread = 0 }: { unread?: number }) {
  const { resolved, setTheme } = useSettings()
  const { pathname } = useLocation()
  const capsule = useActiveCapsule(pathname)
  const { user } = useSession()
  const navigate = useNavigate()
  const initials = user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : 'K'
  const notifLabel = unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'

  return (
    <>
      {/* Mobile: a floating pill above the content, not a bar welded to the edge. */}
      <nav className={styles.bar} aria-label="Navigation principale">
        <ul className={styles.barList} ref={capsule.list}>
          {capsule.at ? (
            <li className={styles.barPill} style={{ transform: `translateX(${capsule.at.x}px)`, width: capsule.at.w }} aria-hidden="true" />
          ) : null}
          {NAV_ITEMS.map((item) => (
            <li key={item.to} className={styles.barItem}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(styles.barLink, isActive && styles.barActive)}
                aria-label={item.to === '/profil' && unread > 0 ? `${item.label}, ${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : item.label}
              >
                <span className={styles.barIcon}>
                  <Icon name={item.icon} />
                  {item.to === '/profil' && unread > 0 ? <StatusDot corner /> : null}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop */}
      <nav className={styles.rail} aria-label="Navigation principale">
        <NavLink to="/" className={styles.brand} aria-label="Keewal Meere, accueil">
          <Wordmark glyphOnly size="sm" />
        </NavLink>

        <ul className={styles.railList}>
          {RAIL_ITEMS.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}
        </ul>

        <ul className={cn(styles.railList, styles.railBottom)}>
          <RailLink item={{ to: '/notifications', label: notifLabel, icon: 'bell', end: false }} badge={unread > 0} />
          <li>
            <button type="button" className={styles.railLink} onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} aria-label={resolved === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}>
              <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
              <span className={styles.tip} aria-hidden="true">
                {resolved === 'dark' ? 'Thème clair' : 'Thème sombre'}
              </span>
            </button>
          </li>
          <li>
            <button type="button" className={cn(styles.railLink, styles.railAvatar)} onClick={() => navigate('/profil')} aria-label="Profil et réglages">
              <span className={styles.initials} aria-hidden="true">
                {initials}
              </span>
              <span className={styles.tip} aria-hidden="true">
                Profil
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}

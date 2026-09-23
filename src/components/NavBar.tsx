/**
 * Navigation.
 * - Mobile: bottom bar, 5 tabs with labels.
 * - Desktop (≥768px): narrow icon rail — brand at the top, primary destinations in the
 *   middle, utilities (notifications, theme, profile) at the bottom. Labels appear as
 *   tooltips on hover/focus; every control keeps an aria-label and a 44px target.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
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

/**
 * Mobile bottom bar — 5 tabs, as specified.
 *
 * Two of them changed on the owner's instruction. **The market tab is a magnifier**, not a
 * chart: what somebody comes to that screen for is a security by name, so the tab says
 * « search » and the screen opens on its search box. **The savings tab is gone**, because
 * Épargne is a row on Accueil and a tab that duplicates a row is a tab spent twice; its
 * seat goes to **Learn** — the book — Keewal Meere's financial-literacy lessons and DP'PA,
 * « les Derniers Papos à Propos de l'Argent ».
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Accueil', icon: 'house', end: true },
  { to: '/crypto', label: 'Rechercher un actif', icon: 'search', end: false },
  { to: '/carte', label: 'Carte', icon: 'credit-card', end: false },
  { to: '/apprendre', label: 'Learn', icon: 'book-open', end: false },
  { to: '/profil', label: 'Profil', icon: 'circle-user-round', end: false },
]

/** Desktop rail — the same destinations plus Activité, which has its own entry there. The
    rail used to open with a search *action* above a separate « Actifs » row, both leading
    to /crypto; with the market tab itself a search, one row says it. */
const RAIL_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Accueil', icon: 'house', end: true },
  { to: '/crypto', label: 'Rechercher un actif', icon: 'search', end: false },
  { to: '/carte', label: 'Carte', icon: 'credit-card', end: false },
  { to: '/apprendre', label: 'Learn', icon: 'book-open', end: false },
  { to: '/activite', label: 'Activité', icon: 'clock', end: false },
]

function RailLink({ item, badge, action = false }: { item: NavItem; badge?: boolean; action?: boolean }) {
  return (
    <li className={styles.railItem}>
      {/* An action is a plain `Link`, not a `NavLink`. Search and « Actifs » both lead to
          /crypto, so on that route two rail entries lit up at once — and suppressing only
          the *class* was not enough: `NavLink` still writes `aria-current="page"`, so the
          capsule measured the first match and parked itself on the search row while
          « Actifs » was the one you were on. Measured, not guessed. Searching is something
          you *do*, not somewhere you are. */}
      {action ? (
        <Link to={item.to} className={styles.railLink} aria-label={item.label}>
          <span className={styles.railIcon}>
            <Icon name={item.icon} />
          </span>
          <span className={styles.tip} aria-hidden="true">
            {item.label}
          </span>
        </Link>
      ) : (
      <NavLink to={item.to} end={item.end} className={({ isActive }) => cn(styles.railLink, isActive && styles.railActive)} aria-label={item.label}>
        <span className={styles.railIcon}>
          <Icon name={item.icon} />
          {badge ? <StatusDot corner /> : null}
        </span>
        <span className={styles.tip} aria-hidden="true">
          {item.label}
        </span>
      </NavLink>
      )}
    </li>
  )
}

/**
 * Where the gold capsule sits, in its list's own coordinates.
 *
 * It used to be a background on whichever link was active, which meant that changing tab
 * cross-faded two gold blobs through each other — for a third of a second there were two
 * lit destinations, and then there was one. A capsule that *moves* is both truer (there is
 * one active destination, and it went somewhere) and the single most recognisable piece of
 * motion in an iOS tab bar. It is measured rather than computed from the index, because the
 * links are not all the same width below 360px.
 *
 * It returns both axes because the pill runs across and the rail runs down; each uses the
 * pair it needs and ignores the other.
 */
function useActiveCapsule(deps: unknown) {
  const list = useRef<HTMLUListElement>(null)
  const [at, setAt] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const measure = () => {
    const root = list.current
    if (!root) return
    /* The <li>, not the <a> inside it. The item is `position: relative` so it can sit
       above the capsule, which makes it the link's own `offsetParent` — so the link's
       `offsetLeft` is 0 on every tab, and the capsule sat under the first one for ever.
       Measured, caught, and this is the line that was wrong. */
    const active = root.querySelector<HTMLElement>('[aria-current="page"]')?.closest('li')
    /* Null on a screen no tab owns — a transaction detail, or the other of the rail's two
       lists. No capsule is the honest answer there; parking it under a tab you are not on
       is not. */
    setAt(active instanceof HTMLElement ? { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight } : null)
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
  const railCapsule = useActiveCapsule(pathname)
  const utilCapsule = useActiveCapsule(pathname)
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
        {/* A plain `Link`: the logo used to be a `NavLink` to « / », so on Accueil it
            announced itself as the current page alongside the Accueil row — two things
            claiming to be where you are. */}
        <Link to="/" className={styles.brand} aria-label="Keewal Meere, accueil">
          <Wordmark glyphOnly size="sm" />
        </Link>

        <ul className={styles.railList} ref={railCapsule.list}>
          {railCapsule.at ? (
            <li
              className={styles.railPill}
              style={{ transform: `translate(${railCapsule.at.x}px, ${railCapsule.at.y}px)`, width: railCapsule.at.w, height: railCapsule.at.h }}
              aria-hidden="true"
            />
          ) : null}
          {RAIL_ITEMS.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}
        </ul>

        {/* The utilities carry their own capsule: /notifications lives down here, and a lit
            destination in one list with a gold capsule in the other would be two ways of
            saying the same thing on the same rail. */}
        <ul className={cn(styles.railList, styles.railBottom)} ref={utilCapsule.list}>
          {utilCapsule.at ? (
            <li
              className={styles.railPill}
              style={{ transform: `translate(${utilCapsule.at.x}px, ${utilCapsule.at.y}px)`, width: utilCapsule.at.w, height: utilCapsule.at.h }}
              aria-hidden="true"
            />
          ) : null}
          <RailLink item={{ to: '/notifications', label: notifLabel, icon: 'bell', end: false }} badge={unread > 0} />
          <li className={styles.railItem}>
            <button type="button" className={styles.railLink} onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} aria-label={resolved === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}>
              <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
              <span className={styles.tip} aria-hidden="true">
                {resolved === 'dark' ? 'Thème clair' : 'Thème sombre'}
              </span>
            </button>
          </li>
          <li className={styles.railItem}>
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

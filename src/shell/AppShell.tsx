import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { api } from '@/api'
import type { AppNotification } from '@/api/types'
import { NAV_ITEMS, NavBar } from '@/components/NavBar'
import { OfflineBanner } from '@/components/States'
import { QK } from '@/store/data'
import { useQuery } from '@/store/query'
import { useSession } from '@/store/session'
import { LockScreen } from './LockScreen'
import { RouteBoundary } from './RouteBoundary'
import styles from './AppShell.module.css'

/** The five destinations the bottom pill owns. */
const PRIMARY = new Set(NAV_ITEMS.map((i) => i.to))

/**
 * How a screen arrives.
 *
 * iOS has two gestures and they mean different things, so they look different. Pushing into
 * a sub-page — an asset, a transaction, a form — brings it in from the right, over the
 * screen you were on; coming back brings the old one in from the left. Switching *tabs* is
 * neither: it is not a stack move, so nothing slides, it cross-fades. Getting that backwards
 * is what makes a web app feel like a web app — every screen arriving the same way, so
 * nothing on screen ever says whether you went deeper or came back.
 *
 * `useNavigationType` is what knows: POP is the back button and the back swipe, PUSH is a
 * link. Direction wins over destination — a pop that lands on a tab is still a pop. This is the whole of it — no View Transitions API, which needs a data router this
 * app does not use, and no exit animation, which would need the outgoing screen kept in the
 * tree. The incoming screen carries the direction on its own.
 */
type Arrival = 'fade' | 'back' | 'forward'

function arrival(pathname: string, type: string): Arrival {
  /* Direction first. Coming back from an asset to the list of assets lands on a primary
     destination, and it is still a pop — checking the destination first said « fade » for
     it, which threw away the direction on the single most common back step in the app. */
  if (type === 'POP') return 'back'
  return PRIMARY.has(pathname) ? 'fade' : 'forward'
}

const ARRIVAL_CLASS: Record<Arrival, string | undefined> = {
  fade: styles.arriveFade,
  back: styles.arriveBack,
  forward: styles.arriveForward,
}

export function AppShell() {
  const { locked } = useSession()
  const { pathname } = useLocation()
  const navType = useNavigationType()
  const notifications = useQuery<AppNotification[]>(QK.notifications, () => api.notifications.list(), { staleTime: 30_000 })
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Aller au contenu
      </a>
      <NavBar unread={unread} />
      <div className={styles.content}>
        <OfflineBanner />
        <main id="main" className={styles.main} tabIndex={-1}>
          {/* The boundary is *inside* the shell on purpose: when a screen's chunk cannot be
              fetched, the navigation, the offline banner and the lock stay on screen, so
              the way out is one tap to a page that is already loaded. Around the shell, the
              same failure took the whole application with it. */}
          <RouteBoundary>
            {/* Keyed on the path so a screen that stays mounted across a parameter change —
                /crypto/btc to /crypto/sonatel is the same component — still arrives. */}
            {/* `data-arrival` is not styling — CSS-module class names are hashed, so it is
                the only stable handle e2e/motion.mjs has to check that the direction a
                screen arrives from is the direction you actually went. `data-path` goes
                with it because the audit was reading the *previous* screen's wrapper in the
                beat before React committed the new route, and calling a stale « back » a
                failure of the tab change that had not rendered yet. */}
            <div key={pathname} data-arrival={arrival(pathname, navType)} data-path={pathname} className={ARRIVAL_CLASS[arrival(pathname, navType)]}>
              <Outlet />
            </div>
          </RouteBoundary>
        </main>
      </div>
      {locked ? <LockScreen /> : null}
    </div>
  )
}

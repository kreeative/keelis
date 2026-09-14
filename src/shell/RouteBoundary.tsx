/**
 * What the app shows when a screen cannot be loaded at all.
 *
 * Every page is a separate chunk, fetched the first time it is opened. On a patchy mobile
 * connection — which is the connection this app is for — that fetch fails, and a failed
 * dynamic import throws where nothing was catching it: React unmounted the whole tree and
 * the screen went **white**. Tapping a tab in a taxi made the application disappear.
 *
 * So this sits inside the shell rather than around it. The navigation, the offline banner
 * and the lock survive; only the page area is replaced, which means the person can still
 * tap back to a screen that is already loaded — the recovery that always works, and the
 * one a reload cannot promise while the connection is still down.
 *
 * It resets itself on navigation: having failed once, the app should not stay broken
 * because the user is now looking at something else.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ErrorState } from '@/components'
import { ApiError } from '@/api/types'

/** How many times the boundary may reload itself before it stops and waits to be asked. */
const MAX_RELOADS = 2
const RELOADS = 'keewal.route-reloads'

interface Props {
  children: ReactNode
  /** Changes on navigation; a new value clears the error. */
  resetKey: string
}

interface State {
  failed: boolean
  offline: boolean
  /**
   * True when the screen's JavaScript never arrived, as opposed to a screen that arrived
   * and then threw. The two need different recoveries: a render error can simply be tried
   * again, while a chunk `import()` that rejected is **cached as rejected** by React.lazy —
   * rendering it again re-throws the same failure for the life of the page, so the only
   * real retry is a reload.
   */
  chunk: boolean
}

/** A screen whose code never downloaded — the failure a bad connection actually causes. */
function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|Unable to preload/i.test(message)
}

class Boundary extends Component<Props, State> {
  state: State = { failed: false, offline: false, chunk: false }
  /** A retry waiting to happen, cancelled if this unmounts first. */
  pending = 0

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, offline: typeof navigator !== 'undefined' && navigator.onLine === false, chunk: isChunkError(error) }
  }

  componentDidMount() {
    window.addEventListener('online', this.onOnline)
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.onOnline)
    if (this.pending) window.clearTimeout(this.pending)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false, offline: false, chunk: false })
  }

  /**
   * The connection came back. Recover without being asked: the page in front of the person
   * is a dead end with nothing on it to lose, and leaving them looking at « vous êtes hors
   * ligne » after the signal returns is the app failing to notice its own good news.
   *
   * The pause matters. `online` fires the moment the device *believes* it has a network,
   * which on a phone that has just found signal is a little before it usually does; a
   * reload started in that window fetches the same chunk and fails the same way, and the
   * second failure has no `online` event left to rescue it. Half a second costs nothing and
   * turns a coin flip into a recovery.
   */
  onOnline = () => {
    if (!this.state.failed) return
    window.setTimeout(() => {
      if (this.state.failed) this.retry()
    }, 500)
  }

  retry = () => {
    // A rejected `import()` stays rejected inside React.lazy for the life of the document,
    // so re-rendering is not a retry. Reloading is, and the app's own files are in cache.
    if (!this.state.chunk) {
      this.setState({ failed: false, offline: false, chunk: false })
      return
    }
    /* Count the automatic reloads. Two is enough to ride out a connection settling; beyond
       that something is wrong that reloading will not fix, and a page that reloads itself
       forever is worse than one that stops and offers a button. */
    let attempts = 0
    try {
      attempts = Number(sessionStorage.getItem(RELOADS) ?? '0')
      sessionStorage.setItem(RELOADS, String(attempts + 1))
    } catch {
      /* private mode: fall through and reload once */
    }
    if (attempts < MAX_RELOADS) window.location.reload()
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Left in deliberately: a chunk that will not load is the kind of failure that only
    // ever shows up on somebody else's connection, and the console is where it is found.
    console.error('Route failed to render', error, info.componentStack)

    /* If the device says it is online and the screen's code still did not arrive, try once
       more shortly. This is the case the `online` listener cannot cover: a reload that was
       started a fraction too early fails the same way, and by then the `online` event has
       already been spent. A signal that has just come back flaps; the budget below is what
       stops that from becoming a loop. */
    if (isChunkError(error) && typeof navigator !== 'undefined' && navigator.onLine) {
      this.pending = window.setTimeout(() => {
        if (this.state.failed) this.retry()
      }, 1_500)
    }
  }

  render() {
    if (!this.state.failed) {
      /* The page rendered: whatever went wrong is behind us, so the next failure starts
         with a full budget rather than inheriting this one's. */
      try {
        sessionStorage.removeItem(RELOADS)
      } catch {
        /* nothing to clear */
      }
      return this.props.children
    }
    return (
      <div className="page">
        <ErrorState
          error={
            new ApiError(
              this.state.offline
                ? 'Cette page n’a pas pu être chargée : vous êtes hors ligne. Les écrans déjà ouverts restent accessibles.'
                : 'Cette page n’a pas pu être chargée. Vérifiez votre connexion, puis réessayez.',
              this.state.offline ? 'offline' : 'network',
            )
          }
          onRetry={this.retry}
        />
      </div>
    )
  }
}

export function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <Boundary resetKey={location.pathname}>{children}</Boundary>
}

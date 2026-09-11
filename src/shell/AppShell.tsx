import { Outlet } from 'react-router-dom'
import { api } from '@/api'
import type { AppNotification } from '@/api/types'
import { NavBar } from '@/components/NavBar'
import { OfflineBanner } from '@/components/States'
import { QK } from '@/store/data'
import { useQuery } from '@/store/query'
import { useSession } from '@/store/session'
import { LockScreen } from './LockScreen'
import styles from './AppShell.module.css'

export function AppShell() {
  const { locked } = useSession()
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
          <Outlet />
        </main>
      </div>
      {locked ? <LockScreen /> : null}
    </div>
  )
}

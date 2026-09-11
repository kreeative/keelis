/**
 * Notifications — regroupées par jour, les non lues en premier plan.
 * Ouvrir une notification la marque lue immédiatement (patch du cache), puis navigue.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AppNotification, type NotificationKind } from '@/api'
import { Button, EmptyState, ErrorState, Icon, ListRow, PageHeader, SkeletonRow, type IconName } from '@/components'
import { useNotifications } from '@/features/shared'
import { dayKey, formatDayHeading, formatRelative } from '@/lib/format'
import { QK, invalidate, setQueryData, useSettings, useToast } from '@/store'
import { cn } from '@/lib/cn'
import styles from './NotificationsPage.module.css'

const KIND_ICON: Record<NotificationKind, IconName> = {
  transaction: 'credit-card',
  security: 'shield',
  market: 'chart-line',
  savings: 'piggy-bank',
  system: 'info',
}

function groupByDay(items: AppNotification[]): Array<{ key: string; date: string; items: AppNotification[] }> {
  const map = new Map<string, { key: string; date: string; items: AppNotification[] }>()
  for (const n of items) {
    const k = dayKey(n.date)
    const g = map.get(k)
    if (g) g.items.push(n)
    else map.set(k, { key: k, date: n.date, items: [n] })
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1))
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { locale } = useSettings()
  const { toast } = useToast()
  const { data, loading, error, refetch } = useNotifications()

  const unread = data?.filter((n) => !n.read).length ?? 0
  const groups = useMemo(() => groupByDay([...(data ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1))), [data])

  const markRead = (n: AppNotification) => {
    if (!n.read) {
      setQueryData<AppNotification[]>(QK.notifications, (prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      void api.notifications.markRead(n.id).catch(() => invalidate(QK.notifications))
    }
    if (n.link) navigate(n.link)
  }

  const markAll = async () => {
    setQueryData<AppNotification[]>(QK.notifications, (prev) => (prev ?? []).map((x) => ({ ...x, read: true })))
    try {
      await api.notifications.markAllRead()
      toast('Tout est marqué comme lu')
    } catch {
      toast('Action impossible. Réessayez.', 'error')
    } finally {
      invalidate(QK.notifications)
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        back={-1}
        title="Notifications"
        actions={
          <Button variant="ghost" onClick={() => void markAll()} disabled={unread === 0}>
            Tout lire
          </Button>
        }
      />
      <p className={styles.count} aria-live="polite">
        {loading ? 'Chargement…' : unread === 0 ? 'Aucune non lue' : `${unread} non lue${unread > 1 ? 's' : ''}`}
      </p>

      <div className={styles.layout}>
        <div className={styles.main} aria-busy={loading || undefined}>
          {loading ? (
            <SkeletonRow count={6} />
          ) : error && !data ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState message="Rien de nouveau. Nous vous prévenons dès qu’il se passe quelque chose." placeholderCaption="Vos alertes apparaîtront ici." />
          ) : (
            groups.map((g) => (
              <section key={g.key} className={styles.group} aria-label={formatDayHeading(g.date, { locale })}>
                <h2 className="t-label">{formatDayHeading(g.date, { locale })}</h2>
                <div className={styles.rows}>
                  {g.items.map((n) => (
                    <button key={n.id} type="button" className={styles.row} onClick={() => markRead(n)}>
                      <span className={cn(styles.circle, !n.read && styles.circleUnread)} aria-hidden="true">
                        <Icon name={KIND_ICON[n.kind]} size={20} />
                      </span>
                      <span className={styles.text}>
                        <span className={styles.head}>
                          <span className={cn(styles.title, !n.read && styles.unread)}>{n.title}</span>
                          <span className={styles.meta}>
                            <span className={styles.time}>{formatRelative(n.date, { locale })}</span>
                            {n.read ? null : <span className={styles.dot} aria-label="Non lue" role="img" />}
                          </span>
                        </span>
                        <span className={styles.body}>{n.body}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className={styles.side}>
          <h2 className="t-label">Résumé</h2>
          <p className={styles.asideNumber}>{unread}</p>
          <p className={styles.asideLabel}>non lue{unread > 1 ? 's' : ''} sur {data?.length ?? 0}</p>
          <div className={styles.asideLink}>
            <ListRow to="/profil/notifications" title="Préférences de notification" subtitle="Choisir ce que vous recevez" chevron />
          </div>
        </aside>
      </div>
    </div>
  )
}

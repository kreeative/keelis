/**
 * Préférences de notification — bascules optimistes, annulées si l’API refuse.
 */
import { api, type NotificationPrefs } from '@/api'
import { ErrorState, List, PageHeader, Skeleton, Switch, type IconName } from '@/components'
import { QK, getQueryData, setQueryData, useQuery, useToast } from '@/store'
import { RowIcon } from './RowIcon'
import { SettingRow } from './SettingRow'
import styles from './NotificationPrefsPage.module.css'

type PrefKey = keyof NotificationPrefs

const ROWS: ReadonlyArray<{ key: PrefKey; title: string; subtitle: string; icon: IconName; locked?: boolean }> = [
  { key: 'transactions', title: 'Transactions', subtitle: 'Paiements, virements, dépôts et retraits', icon: 'credit-card' },
  { key: 'security', title: 'Sécurité', subtitle: 'Connexions et changements sensibles', icon: 'shield', locked: true },
  { key: 'market', title: 'Marché', subtitle: 'Variations notables sur vos cryptomonnaies', icon: 'chart-line' },
  { key: 'savings', title: 'Épargne', subtitle: 'Intérêts versés et progression des objectifs', icon: 'piggy-bank' },
  { key: 'marketing', title: 'Offres', subtitle: 'Nouveautés et propositions de Keelis', icon: 'star' },
]

export default function NotificationPrefsPage() {
  const { toast } = useToast()
  const prefs = useQuery<NotificationPrefs>(QK.notificationPrefs, () => api.notifications.prefs())

  const update = async (key: PrefKey, next: boolean) => {
    const previous = getQueryData<NotificationPrefs>(QK.notificationPrefs) ?? prefs.data
    if (!previous) return
    const updated = { ...previous, [key]: next }
    setQueryData<NotificationPrefs>(QK.notificationPrefs, () => updated)
    try {
      await api.notifications.setPrefs(updated)
      toast('Préférences enregistrées')
    } catch {
      setQueryData<NotificationPrefs>(QK.notificationPrefs, () => previous)
      toast('Enregistrement impossible. Réessayez.', 'error')
    }
  }

  const data = prefs.data

  return (
    <div className={styles.page}>
      <PageHeader back="/profil" title="Notifications" />
      <p className={styles.intro}>Choisissez ce que Keelis vous envoie. Les alertes de sécurité restent toujours actives.</p>

      <section className={styles.section} aria-label="Préférences de notification">
        {prefs.loading ? (
          <div className={styles.skeletons}>
            {ROWS.map((r) => (
              <Skeleton key={r.key} height={64} shape="card" />
            ))}
          </div>
        ) : prefs.error && !data ? (
          <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} />
        ) : data ? (
          <List>
            {ROWS.map((r) => (
              <SettingRow
                key={r.key}
                leading={<RowIcon name={r.icon} />}
                title={r.title}
                subtitle={r.locked ? 'Toujours activé — connexions et changements sensibles' : r.subtitle}
                control={<Switch checked={r.locked ? true : data[r.key]} onChange={(v) => void update(r.key, v)} label={r.title} disabled={r.locked} />}
              />
            ))}
          </List>
        ) : null}
      </section>

      <p className={styles.footnote}>Les notifications s’affichent dans l’application et sur vos appareils connectés.</p>
    </div>
  )
}

/**
 * Documents et relevés — un relevé mensuel par compte, en PDF.
 */
import { useMemo, useState } from 'react'
import { api, type Statement } from '@/api'
import { Button, EmptyState, ErrorState, Icon, List, ListRow, PageHeader, SegmentedControl, Skeleton } from '@/components'
import { useAccounts } from '@/features/shared'
import { QK, useQuery, useToast } from '@/store'
import { RowIcon } from './RowIcon'
import styles from './DocumentsPage.module.css'

type Scope = 'checking' | 'savings'

const SCOPES: ReadonlyArray<{ value: Scope; label: string }> = [
  { value: 'checking', label: 'Chèque' },
  { value: 'savings', label: 'Épargne' },
]

export default function DocumentsPage() {
  const { toast } = useToast()
  const [scope, setScope] = useState<Scope>('checking')
  const statements = useQuery<Statement[]>(QK.statements, () => api.profile.statements())

  const accounts = useAccounts()
  const accountId = accounts.data?.find((a) => a.kind === scope)?.id
  const items = useMemo(() => statements.data?.filter((s) => s.accountId === accountId) ?? [], [statements.data, accountId])

  return (
    <div className={styles.page}>
      <PageHeader back="/profil" title="Documents et relevés" />

      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.tabs}>
            <SegmentedControl segments={SCOPES} value={scope} onChange={setScope} label="Compte" block />
          </div>

          <section className={styles.list} aria-label={`Relevés — compte ${scope === 'checking' ? 'Chèque' : 'Épargne'}`} aria-busy={statements.loading || undefined}>
            {statements.loading ? (
              <div className={styles.skeletons}>
                <Skeleton height={64} shape="card" />
                <Skeleton height={64} shape="card" />
                <Skeleton height={64} shape="card" />
              </div>
            ) : statements.error && !statements.data ? (
              <ErrorState error={statements.error} onRetry={() => void statements.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState message="Aucun relevé pour ce compte pour l’instant." placeholderCaption="Vos relevés apparaîtront ici chaque mois." />
            ) : (
              <List>
                {items.map((s) => (
                  <ListRow
                    key={s.id}
                    static
                    leading={<RowIcon name="file-text" />}
                    title={s.period}
                    subtitle="Relevé mensuel · PDF"
                    trailing={
                      <Button variant="ghost" iconOnly aria-label={`Télécharger le relevé ${s.period}`} onClick={() => toast(`Relevé ${s.period} · téléchargement lancé`)}>
                        <Icon name="download" size={20} />
                      </Button>
                    }
                  />
                ))}
              </List>
            )}
          </section>
        </div>

        <aside className={styles.side}>
          <h2 className="t-section">Bon à savoir</h2>
          <p className={styles.note}>Le relevé du mois est déposé le premier jour du mois suivant. Les douze derniers mois restent accessibles ici.</p>
          <List>
            <ListRow to="/profil/fiscalite" leading={<RowIcon name="receipt" />} title="Fiscalité" subtitle={<span className={styles.wrap}>Feuillets T5, Relevé 3 et rapport crypto</span>} chevron />
          </List>
        </aside>
      </div>
    </div>
  )
}

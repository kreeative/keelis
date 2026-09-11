/**
 * Fiscalité — feuillets annuels, groupés par année.
 */
import { useMemo } from 'react'
import { api, type TaxDocument } from '@/api'
import { Badge, Button, EmptyState, ErrorState, Icon, List, ListRow, PageHeader, Skeleton } from '@/components'
import { QK, useQuery, useToast } from '@/store'
import { RowIcon } from './RowIcon'
import styles from './TaxPage.module.css'

export default function TaxPage() {
  const { toast } = useToast()
  const docs = useQuery<TaxDocument[]>(QK.taxDocs, () => api.profile.taxDocuments())

  const years = useMemo(() => {
    const map = new Map<number, TaxDocument[]>()
    for (const d of docs.data ?? []) {
      const list = map.get(d.year)
      if (list) list.push(d)
      else map.set(d.year, [d])
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [docs.data])

  return (
    <div className={styles.page}>
      <PageHeader back="/profil" title="Fiscalité" />
      <p className={styles.intro}>Vos feuillets sont disponibles chaque année en février.</p>

      <div className={styles.layout}>
        <div className={styles.main} aria-busy={docs.loading || undefined}>
          {docs.loading ? (
            <div className={styles.skeletons}>
              <Skeleton height={64} shape="card" />
              <Skeleton height={64} shape="card" />
              <Skeleton height={64} shape="card" />
            </div>
          ) : docs.error && !docs.data ? (
            <ErrorState error={docs.error} onRetry={() => void docs.refetch()} />
          ) : years.length === 0 ? (
            <EmptyState message="Aucun feuillet pour l’instant." placeholderCaption="Vos feuillets apparaîtront ici en février." />
          ) : (
            years.map(([year, items]) => (
              <section key={year} className={styles.year} aria-labelledby={`year-${year}`}>
                <h2 className="t-section" id={`year-${year}`}>
                  Année {year}
                </h2>
                <List>
                  {items.map((d) => (
                    <ListRow
                      key={d.id}
                      static
                      leading={<RowIcon name="receipt" />}
                      title={<span className={styles.wrap}>{d.name}</span>}
                      subtitle={`Année d’imposition ${d.year}`}
                      trailing={
                        d.available ? (
                          <Button variant="ghost" iconOnly aria-label={`Télécharger ${d.name}`} onClick={() => toast(`${d.name} · téléchargement lancé`)}>
                            <Icon name="download" size={20} />
                          </Button>
                        ) : (
                          <Badge tone="neutral">En février</Badge>
                        )
                      }
                    />
                  ))}
                </List>
              </section>
            ))
          )}
        </div>

        <aside className={styles.side}>
          <h2 className="t-section">Cryptomonnaies</h2>
          <p className={styles.note}>
            Les gains et les pertes en cryptomonnaie se déclarent vous-même. Keelis fournit l’historique complet de vos transactions, sans remplacer un conseil fiscal.
          </p>
          <List>
            <ListRow to="/profil/documents" leading={<RowIcon name="file-text" />} title="Documents et relevés" subtitle="Relevés mensuels en PDF" chevron />
          </List>
        </aside>
      </div>
    </div>
  )
}

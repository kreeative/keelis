/**
 * /envoyer/operateurs — every rail money can leave Keelis through.
 *
 * This exists as its own page because "e-Transfer" was one segment of a three-way control,
 * and behind that one word sit fifteen operators that work nothing alike: a phone number
 * in Dakar, a tag in London, a counter where someone collects cash in Bamako. A picker
 * that long does not belong inside a form someone is already filling in.
 *
 * The families are **grouped, not ranked**. Which rail is right depends entirely on where
 * the recipient is standing, so the page refuses to imply an order of merit — it says what
 * each one needs, what it costs and how long it takes, and lets the sender decide.
 */
import { useMemo, useState } from 'react'
import { api } from '@/api'
import type { TransferProvider } from '@/api/types'
import { Avatar, Badge, Card, ChipBar, EmptyState, ErrorState, Field, Icon, List, ListRow, PageHeader, SkeletonRow } from '@/components'
import { TRANSFER_FAMILY_LABEL, TRANSFER_HANDLE_LABEL } from '@/api/mock/seed'
import { formatMoney, formatPercent } from '@/lib/format'
import { QK, useQuery, useSettings } from '@/store'
import styles from './TransferProvidersPage.module.css'

const FAMILY_ORDER: ReadonlyArray<TransferProvider['family']> = ['mobile_money', 'wallet', 'remittance', 'bank']

const FILTERS = [{ value: 'all', label: 'Tous' }, ...FAMILY_ORDER.map((f) => ({ value: f, label: TRANSFER_FAMILY_LABEL[f] }))]

export default function TransferProvidersPage() {
  const { locale } = useSettings()
  const providers = useQuery<TransferProvider[]>(QK.transferProviders, () => api.transfers.providers())
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (providers.data ?? []).filter(
      (p) => (filter === 'all' || p.family === filter) && (!q || p.name.toLowerCase().includes(q) || p.reach.toLowerCase().includes(q)),
    )
    return FAMILY_ORDER.map((family) => ({ family, items: list.filter((p) => p.family === family) })).filter((g) => g.items.length > 0)
  }, [providers.data, filter, search])

  /** Fee as one short phrase: a percentage, a flat amount, both, or free. */
  const feeLine = (p: TransferProvider): string => {
    const pct = p.feePct > 0 ? formatPercent(p.feePct * 100, { locale, signed: false }) : null
    const flat = p.feeFixed ? formatMoney(p.feeFixed, { locale, currency: p.currency }) : null
    if (!pct && !flat) return 'Sans frais'
    return [pct, flat].filter(Boolean).join(' + ')
  }

  return (
    <div className="page">
      <PageHeader title="Envoyer vers" back={-1} />
      <p className={styles.intro}>
        Choisissez l’opérateur qui atteint votre destinataire. Les frais et délais affichés sont des
        valeurs de démonstration, pas une grille tarifaire.
      </p>

      <Field
        label="Rechercher un opérateur"
        hideLabel
        type="search"
        inputMode="search"
        placeholder="Wave, Orange Money, un pays…"
        value={search}
        leading={<Icon name="search" size={18} />}
        onChange={(e) => setSearch(e.target.value)}
        className={styles.search}
      />

      <ChipBar chips={FILTERS} value={filter} onChange={setFilter} label="Familles d’opérateurs" className={styles.filters} />

      {providers.error && !providers.data ? (
        <ErrorState error={providers.error} onRetry={() => void providers.refetch()} />
      ) : providers.loading && !providers.data ? (
        <Card padding="md" elevation={1}>
          <SkeletonRow count={6} />
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState compact message="Aucun opérateur ne correspond à cette recherche." />
      ) : (
        groups.map((g) => (
          <section key={g.family} className={styles.group} aria-labelledby={`grp-${g.family}`}>
            <h2 id={`grp-${g.family}`} className="t-section">
              {TRANSFER_FAMILY_LABEL[g.family]}
            </h2>
            <Card padding="md" elevation={1}>
              <List>
                {g.items.map((p) => (
                  <ListRow
                    key={p.id}
                    stack
                    /* An operator that is not connected yet is shown, because knowing it is
                       coming is worth something — but it does not pretend to be tappable. */
                    to={p.available ? `/envoyer?operateur=${p.id}` : undefined}
                    static={!p.available}
                    leading={<Avatar label={p.name} monogram={p.mark} size={36} />}
                    title={p.name}
                    subtitle={
                      <>
                        {p.reach}
                        <br />
                        {TRANSFER_HANDLE_LABEL[p.handle]} · {p.eta}
                      </>
                    }
                    value={feeLine(p)}
                    valueSub={p.available ? undefined : <Badge tone="neutral">{p.note ?? 'Bientôt'}</Badge>}
                    muted={!p.available}
                    chevron={p.available}
                  />
                ))}
              </List>
            </Card>
          </section>
        ))
      )}
    </div>
  )
}

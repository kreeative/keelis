/**
 * /crypto/recurrents — monthly total as the hero, one row per recurring buy (pause switch),
 * detail sheet with a two-step delete, and a creation sheet.
 */
import { useMemo, useState } from 'react'
import { api } from '@/api'
import type { ApiError, RecurringBuy, RecurringFrequency } from '@/api/types'
import { AmountDisplay, Avatar, Button, EmptyState, ErrorState, Field, Icon, List, Money, PageHeader, SegmentedControl, SelectField, Sheet, SkeletonRow, Switch } from '@/components'
import { formatDate, formatMoney, parseAmountInput } from '@/lib/format'
import { QK, useMutation, useSettings, useToast } from '@/store'
import { cn } from '@/lib/cn'
import { FREQUENCIES, FREQUENCY_ORDER, floorTo, formatRate, formatShortDate, monthlyTotal } from './cryptoFormat'
import { patchQuery, useLiveAssets, useLiveRecurring } from './hooks'
import styles from './RecurringPage.module.css'

const MIN_AMOUNT = 5
const FREQUENCY_SEGMENTS = FREQUENCY_ORDER.map((f) => ({ value: f, label: FREQUENCIES[f].short }))

function rowTitle(item: RecurringBuy, locale: 'fr-CA' | 'en-CA'): string {
  return `${formatMoney(item.amount, { locale })} de ${item.symbol}`
}

function RecurringRow({ item, onOpen, onToggle }: { item: RecurringBuy; onOpen: () => void; onToggle: (next: boolean) => void }) {
  const { locale } = useSettings()
  const title = rowTitle(item, locale)
  const subtitle = item.active ? `${FREQUENCIES[item.frequency].sentence} · prochain le ${formatShortDate(item.nextRun, locale)}` : `${FREQUENCIES[item.frequency].sentence} · en pause`
  return (
    <div className={styles.row}>
      <button type="button" className={styles.rowMain} onClick={onOpen}>
        <Avatar label={item.symbol} monogram={item.symbol} />
        <span className={styles.rowText}>
          <span className={cn(styles.rowTitle, !item.active && styles.muted)}>{title}</span>
          <span className={styles.rowSub}>{subtitle}</span>
        </span>
        <Icon name="chevron-right" className={styles.chevron} />
      </button>
      <Switch checked={item.active} onChange={onToggle} label={`${item.active ? 'Mettre en pause' : 'Reprendre'} : ${title}`} />
    </div>
  )
}

export default function RecurringPage() {
  const { locale } = useSettings()
  const { toast } = useToast()
  const market = useLiveAssets()
  const byId = useMemo(() => new Map((market.assets ?? []).map((a) => [a.id, a] as const)), [market.assets])
  const recurring = useLiveRecurring()
  const items = useMemo(() => (recurring.data ?? []).slice().sort((a, b) => (a.nextRun < b.nextRun ? -1 : 1)), [recurring.data])
  const activeCount = items.filter((r) => r.active).length
  const monthly = monthlyTotal(items)
  const caption = `par mois, ${activeCount === 0 ? 'aucun achat actif' : activeCount === 1 ? '1 achat actif' : `${activeCount} achats actifs`}`

  // ----- pause / resume (optimistic)
  const toggle = async (item: RecurringBuy, next: boolean) => {
    patchQuery<RecurringBuy[]>(QK.recurring, (list) => (list ?? []).map((r) => (r.id === item.id ? { ...r, active: next } : r)))
    try {
      await api.crypto.recurring.update(item.id, { active: next })
      toast(next ? 'Achat récurrent repris' : 'Achat récurrent mis en pause')
    } catch (err) {
      patchQuery<RecurringBuy[]>(QK.recurring, (list) => (list ?? []).map((r) => (r.id === item.id ? { ...r, active: !next } : r)))
      toast(err instanceof Error ? err.message : 'Modification impossible', 'error')
    }
  }

  // ----- detail sheet + two-step delete
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [step, setStep] = useState<'view' | 'confirm'>('view')
  const selected = items.find((r) => r.id === selectedId) ?? null
  const removeM = useMutation((id: string) => api.crypto.recurring.remove(id))
  const closeDetail = () => {
    if (removeM.pending) return
    setSelectedId(null)
    setStep('view')
    removeM.reset()
  }
  const remove = async () => {
    if (!selected) return
    const id = selected.id
    try {
      await removeM.mutate(id)
      patchQuery<RecurringBuy[]>(QK.recurring, (list) => (list ?? []).filter((r) => r.id !== id))
      setSelectedId(null)
      setStep('view')
      toast('Achat récurrent supprimé')
    } catch {
      /* shown in the sheet */
    }
  }

  // ----- creation sheet
  const [createOpen, setCreateOpen] = useState(false)
  const [assetId, setAssetId] = useState('btc')
  const [amountRaw, setAmountRaw] = useState('')
  const [frequency, setFrequency] = useState<RecurringFrequency>('weekly')
  const [amountError, setAmountError] = useState<string | null>(null)
  const createM = useMutation((input: { assetId: string; amount: number; frequency: RecurringFrequency }) => api.crypto.recurring.create(input))
  const assets = useMemo(() => (market.assets ?? []).slice().sort((a, b) => a.rank - b.rank), [market.assets])
  const chosenAsset = byId.get(assetId) ?? assets[0]
  const amount = parseAmountInput(amountRaw)
  const nextRun = new Date(Date.now() + FREQUENCIES[frequency].days * 86_400_000)
  const openCreate = () => {
    setAmountRaw('')
    setAmountError(null)
    setFrequency('weekly')
    createM.reset()
    setCreateOpen(true)
  }
  const closeCreate = () => {
    if (createM.pending) return
    setCreateOpen(false)
  }
  const submit = async () => {
    if (!chosenAsset) return
    if (!(amount >= MIN_AMOUNT)) {
      setAmountError(`Minimum ${formatMoney(MIN_AMOUNT, { locale })}`)
      return
    }
    try {
      const created = await createM.mutate({ assetId: chosenAsset.id, amount: floorTo(amount, 2), frequency })
      patchQuery<RecurringBuy[]>(QK.recurring, (list) => [...(list ?? []).filter((r) => r.id !== created.id), created])
      setCreateOpen(false)
      toast('Achat récurrent créé')
    } catch (err) {
      setAmountError((err as ApiError).message)
    }
  }

  const firstLoad = recurring.data === undefined && !recurring.error
  const failed = recurring.data === undefined && !!recurring.error
  const createButton = (
    <Button size="lg" block onClick={openCreate} icon={<Icon name="plus" size={20} />}>
      Nouvel achat récurrent
    </Button>
  )

  return (
    <div className={cn('page', styles.recurring)}>
      <PageHeader back="/crypto" title="Achats récurrents" eyebrow="Crypto" />

      <section className={styles.hero} aria-label="Total mensuel">
        {failed ? <ErrorState error={recurring.error} onRetry={() => void recurring.refetch()} compact /> : <AmountDisplay size="h1" value={firstLoad ? undefined : monthly} caption={caption} loading={firstLoad} />}
      </section>

      <section className={styles.listSection} aria-label="Achats programmés" aria-busy={firstLoad || undefined}>
        {firstLoad ? (
          <SkeletonRow count={2} />
        ) : failed ? null : items.length === 0 ? (
          <EmptyState message="Automatisez vos achats, à partir de 5 $ par période." action={createButton} compact />
        ) : (
          <>
            <List label="Achats récurrents">
              {items.map((r) => (
                <RecurringRow key={r.id} item={r} onOpen={() => setSelectedId(r.id)} onToggle={(next) => void toggle(r, next)} />
              ))}
            </List>
            <div className={styles.cta}>{createButton}</div>
          </>
        )}
      </section>

      <Sheet open={!!selected} onClose={closeDetail} title={selected ? rowTitle(selected, locale) : undefined} locked={removeM.pending}
        footer={
          selected ? (
            step === 'view' ? (
              <>
                <Button variant="destructive" size="lg" block onClick={() => setStep('confirm')}>
                  Supprimer
                </Button>
                <Button variant="ghost" block onClick={closeDetail}>
                  Fermer
                </Button>
              </>
            ) : (
              <>
                <Button variant="destructive" size="lg" block onClick={() => void remove()} loading={removeM.pending}>
                  Confirmer la suppression
                </Button>
                <Button variant="ghost" block onClick={() => setStep('view')} disabled={removeM.pending}>
                  Annuler
                </Button>
              </>
            )
          ) : null
        }
      >
        {selected ? (
          <>
            <dl className={styles.lines}>
              <div className={styles.line}>
                <dt className={styles.lineLabel}>Actif</dt>
                <dd className={styles.lineValue}>{byId.get(selected.assetId)?.name ?? selected.symbol}</dd>
              </div>
              <div className={styles.line}>
                <dt className={styles.lineLabel}>Montant</dt>
                <dd className={styles.lineValue}>
                  <Money value={selected.amount} unmasked />
                </dd>
              </div>
              <div className={styles.line}>
                <dt className={styles.lineLabel}>Fréquence</dt>
                <dd className={styles.lineValue}>{FREQUENCIES[selected.frequency].sentence}</dd>
              </div>
              <div className={styles.line}>
                <dt className={styles.lineLabel}>Prochaine exécution</dt>
                <dd className={styles.lineValue}>{selected.active ? formatDate(selected.nextRun, { locale }) : 'En pause'}</dd>
              </div>
              <div className={styles.line}>
                <dt className={styles.lineLabel}>Écart (spread)</dt>
                <dd className={styles.lineValue}>{formatRate(byId.get(selected.assetId)?.spreadPct ?? 0, locale)}</dd>
              </div>
              <div className={styles.line}>
                <dt className={styles.lineLabel}>Frais</dt>
                <dd className={styles.lineValue}>
                  <Money value={0} unmasked />
                </dd>
              </div>
              <div className={styles.line}>
                <dt className={styles.lineLabel}>Créé le</dt>
                <dd className={styles.lineValue}>{formatDate(selected.createdAt, { locale })}</dd>
              </div>
            </dl>
            {step === 'confirm' ? (
              <p className={styles.confirmText} role="alert">
                Supprimer cet achat récurrent ? Les achats déjà exécutés restent dans votre historique.
              </p>
            ) : null}
            {removeM.error ? (
              <p className={styles.error} role="alert">
                {removeM.error.message}
              </p>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet open={createOpen} onClose={closeCreate} title="Nouvel achat récurrent" locked={createM.pending}
        footer={
          <>
            <Button size="lg" block onClick={() => void submit()} loading={createM.pending} disabled={!chosenAsset}>
              Créer
            </Button>
            <Button variant="ghost" block onClick={closeCreate} disabled={createM.pending}>
              Annuler
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <SelectField label="Actif" value={chosenAsset?.id ?? ''} onChange={(e) => setAssetId(e.target.value)} disabled={assets.length === 0}>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.symbol}
              </option>
            ))}
          </SelectField>
          <Field
            label="Montant"
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            value={amountRaw}
            onChange={(e) => {
              setAmountRaw(e.target.value)
              if (amountError) setAmountError(null)
            }}
            hint={`Minimum ${formatMoney(MIN_AMOUNT, { locale })}`}
            error={amountError ?? undefined}
            trailing={<span className={styles.unit}>$</span>}
          />
          <div className={styles.field}>
            <p className="t-label" id="frequency-label">
              Fréquence
            </p>
            <SegmentedControl segments={FREQUENCY_SEGMENTS} value={frequency} onChange={setFrequency} label="Fréquence" size="sm" block className={styles.freq} />
          </div>
          <p className={styles.next} aria-live="polite">
            Prochaine exécution : {formatDate(nextRun, { locale })}
          </p>
          <dl className={styles.summary}>
            <div className={styles.line}>
              <dt className={styles.lineLabel}>Montant</dt>
              <dd className={styles.lineValue}>{formatMoney(amount, { locale })}</dd>
            </div>
            <div className={styles.line}>
              <dt className={styles.lineLabel}>Fréquence</dt>
              <dd className={styles.lineValue}>{FREQUENCIES[frequency].sentence}</dd>
            </div>
            <div className={styles.line}>
              <dt className={styles.lineLabel}>Écart (spread)</dt>
              <dd className={styles.lineValue}>{formatRate(chosenAsset?.spreadPct ?? 0, locale)}</dd>
            </div>
            <div className={styles.line}>
              <dt className={styles.lineLabel}>Frais</dt>
              <dd className={styles.lineValue}>{formatMoney(0, { locale })}</dd>
            </div>
          </dl>
        </div>
      </Sheet>
    </div>
  )
}

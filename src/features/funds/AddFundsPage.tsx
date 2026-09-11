/**
 * Ajouter des fonds — deux temps : d’abord d’où vient l’argent et où il va,
 * ensuite combien. Les frais, la limite quotidienne et le délai sont affichés
 * avant la confirmation ; la confirmation mène à la page de statut.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, IDS } from '@/api'
import { ApiError, type AccountDetails, type FundingSource } from '@/api/types'
import { Badge, Button, EmptyState, ErrorState, Icon, List, ListRow, Money, PageHeader, SegmentedControl, Sheet, Skeleton, SkeletonRow, type IconName } from '@/components'
import { AmountEntry, ConfirmSheet, useAccounts } from '@/features/shared'
import { formatMoney, parseAmountInput } from '@/lib/format'
import { QK, useQuery, useSettings, useToast } from '@/store'
import styles from './AddFundsPage.module.css'

type Destination = 'cheque' | 'epargne'

const DESTINATIONS: ReadonlyArray<{ value: Destination; label: string; accountId: string; name: string }> = [
  { value: 'cheque', label: 'Chèque', accountId: IDS.checking, name: 'Compte Chèque' },
  { value: 'epargne', label: 'Épargne', accountId: IDS.savings, name: 'Compte Épargne' },
]

const SOURCE_ICONS: Record<FundingSource['kind'], IconName> = {
  bank: 'landmark',
  etransfer: 'send',
  wire: 'building-2',
  card: 'credit-card',
}

const PRESETS = [100, 250, 500, 1000]

/** Every ApiError code gets a sentence that says what to do next. */
function depositError(err: unknown): ApiError {
  if (!(err instanceof ApiError)) return new ApiError('Le dépôt n’a pas pu être lancé. Réessayez.', 'unknown')
  switch (err.code) {
    case 'offline':
      return new ApiError('Vous êtes hors ligne. Reconnectez-vous, puis lancez le dépôt de nouveau.', 'offline', err.details)
    case 'network':
      return new ApiError('La demande n’a pas abouti. Réessayez dans un instant.', 'network', err.details)
    case 'insufficient_funds':
      return new ApiError('Le solde de la source ne couvre pas ce montant. Choisissez un montant plus petit.', 'insufficient_funds', err.details)
    case 'not_found':
      return new ApiError('Cette source de fonds n’est plus disponible. Choisissez-en une autre.', 'not_found', err.details)
    default:
      return err
  }
}

export default function AddFundsPage() {
  const navigate = useNavigate()
  const { locale } = useSettings()
  const { toast } = useToast()

  const sources = useQuery<FundingSource[]>(QK.fundingSources, () => api.funding.sources(), { staleTime: 60_000 })
  const accounts = useAccounts()

  const [destination, setDestination] = useState<Destination>('cheque')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)
  const [wireOpen, setWireOpen] = useState(false)

  const target = DESTINATIONS.find((d) => d.value === destination) ?? DESTINATIONS[0]!
  const account = accounts.data?.find((a) => a.id === target.accountId)
  const source = sources.data?.find((s) => s.id === sourceId) ?? null
  const value = useMemo(() => parseAmountInput(amount), [amount])
  const fee = source ? Math.round(value * source.feePct * 100) / 100 : 0
  const total = value + fee

  const details = useQuery<AccountDetails>(wireOpen ? QK.accountDetails(IDS.checking) : null, () => api.accounts.details(IDS.checking), { staleTime: 60_000 })

  const choose = (id: string) => {
    setSourceId(id)
    setAmountError(null)
    setSubmitError(null)
  }

  const validate = (): boolean => {
    if (!source) return false
    if (!(value > 0)) {
      setAmountError('Entrez un montant.')
      return false
    }
    if (value > source.limitPerDay) {
      setAmountError(`Limite quotidienne : ${formatMoney(source.limitPerDay, { locale, compactCents: true })}`)
      return false
    }
    setAmountError(null)
    return true
  }

  const submit = async () => {
    if (!source) return
    setPending(true)
    setSubmitError(null)
    try {
      const movement = await api.funding.addFunds({ sourceId: source.id, destinationAccountId: target.accountId, amount: value })
      setConfirmOpen(false)
      navigate(`/fonds/statut/${movement.transactionId}`, { replace: true })
    } catch (err) {
      const apiErr = depositError(err)
      if (apiErr.code === 'validation') {
        setConfirmOpen(false)
        setAmountError(apiErr.message)
      } else {
        setSubmitError(apiErr)
      }
    } finally {
      setPending(false)
    }
  }

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(`Copié : ${what}`)
    } catch {
      toast('Impossible de copier', 'error')
    }
  }

  const wireRows = details.data
    ? [
        { label: 'Titulaire', value: details.data.holderName, short: 'le nom du titulaire', mono: false },
        { label: 'Institution', value: details.data.institutionNumber, short: 'le numéro d’institution', mono: true },
        { label: 'Transit', value: details.data.transitNumber, short: 'le numéro de transit', mono: true },
        { label: 'Numéro de compte', value: details.data.accountNumber, short: 'le numéro de compte', mono: true },
        { label: 'IBAN', value: details.data.iban, short: 'l’IBAN', mono: true },
        { label: 'SWIFT/BIC', value: details.data.swift, short: 'le code SWIFT', mono: true },
      ]
    : []

  return (
    <div className={styles.page}>
      <PageHeader close back={-1} title="Ajouter des fonds" eyebrow={`Étape ${source ? 2 : 1} sur 2`} />

      <div className={styles.layout}>
        <div className={styles.main}>
          {source ? (
            <section className={styles.chosen} aria-label="Source sélectionnée">
              <Badge tone="neutral" icon={<Icon name={SOURCE_ICONS[source.kind]} size={14} />}>
                {source.label}
              </Badge>
              <Button variant="ghost" onClick={() => setSourceId(null)}>
                Changer
              </Button>
            </section>
          ) : (
            <>
              <section className={styles.block} aria-labelledby="funds-destination">
                <h2 id="funds-destination" className="t-label">
                  Déposer dans
                </h2>
                <SegmentedControl
                  segments={DESTINATIONS.map((d) => ({ value: d.value, label: d.label }))}
                  value={destination}
                  onChange={setDestination}
                  label="Compte de destination"
                  block
                />
              </section>

              <section className={styles.block} aria-labelledby="funds-sources">
                <h2 id="funds-sources" className="t-label">
                  Provenance
                </h2>
                {sources.error && !sources.data ? (
                  <ErrorState error={sources.error} onRetry={() => void sources.refetch()} />
                ) : sources.loading ? (
                  <SkeletonRow count={4} />
                ) : sources.data && sources.data.length === 0 ? (
                  <EmptyState compact message="Aucune source de fonds n’est reliée à votre compte pour l’instant." />
                ) : (
                  <List>
                    {sources.data?.map((s) => (
                      <ListRow
                        key={s.id}
                        onClick={() => choose(s.id)}
                        leading={
                          <span className={styles.circle} aria-hidden="true">
                            <Icon name={SOURCE_ICONS[s.kind]} size={20} />
                          </span>
                        }
                        title={s.label}
                        subtitle={<span className={styles.sourceMeta}>{`${s.mask} · ${s.eta}`}</span>}
                        chevron
                      />
                    ))}
                  </List>
                )}
              </section>
            </>
          )}

          {source ? (
            <section className={styles.amount} aria-labelledby="funds-amount">
              <h2 id="funds-amount" className="sr-only">
                Montant à déposer
              </h2>
              <AmountEntry
                label="Montant à déposer"
                value={amount}
                onChange={(v) => {
                  setAmount(v)
                  setAmountError(null)
                }}
                presets={PRESETS}
                secondary={`Limite quotidienne : ${formatMoney(source.limitPerDay, { locale, compactCents: true })} · Délai : ${source.eta}`}
                error={amountError}
              />
            </section>
          ) : null}
        </div>

        <aside className={styles.aside}>
          {source ? (
            <>
              <h2 className="t-label">Aperçu</h2>
              <List>
                <ListRow static title="Source" subtitle={source.mask} value={source.label} />
                <ListRow
                  static
                  title="Destination"
                  subtitle={account ? <>Solde : <Money value={account.balance} /></> : undefined}
                  value={target.name.replace('Compte ', '')}
                />
                <ListRow static title="Frais" value={<Money value={fee} unmasked />} />
                <ListRow static title="Délai" value={source.eta} />
              </List>
              <div className={styles.asideActions}>
                <Button
                  size="lg"
                  block
                  onClick={() => {
                    if (validate()) setConfirmOpen(true)
                  }}
                >
                  Continuer
                </Button>
                {source.kind === 'wire' ? (
                  <Button variant="ghost" block onClick={() => setWireOpen(true)}>
                    Instructions de virement
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2 className="t-label">{target.name}</h2>
              {accounts.error && !account ? (
                <ErrorState compact error={accounts.error} onRetry={() => void accounts.refetch()} />
              ) : (
                <>
                  <div className={styles.balance}>
                    {account ? <Money value={account.balance} className={styles.balanceValue} /> : <Skeleton width="60%" height="var(--fs-h2)" />}
                    <p className={styles.balanceCaption}>Solde actuel</p>
                  </div>
                  <p className={styles.asideNote}>Les fonds arrivent dans ce compte, puis se déplacent librement entre vos comptes Kaalis, sans frais.</p>
                </>
              )}
            </>
          )}
        </aside>
      </div>

      {source ? (
        <ConfirmSheet
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Confirmer le dépôt"
          hero={<Money value={value} unmasked />}
          heroCaption={`Vers ${target.name}`}
          lines={[
            { label: 'Source', value: source.label, hint: source.mask },
            { label: 'Destination', value: target.name },
            { label: 'Montant', value: <Money value={value} unmasked /> },
            { label: 'Frais', value: <Money value={fee} unmasked /> },
            { label: 'Écart de change', value: 'Aucun', hint: 'Dépôt en dollars canadiens' },
            { label: 'Total débité', value: <Money value={total} unmasked />, strong: true },
            { label: 'Délai', value: source.eta },
          ]}
          note={
            fee > 0
              ? `Les frais de ${formatMoney(fee, { locale })} sont prélevés par ${source.label} et inclus dans le total débité.`
              : 'Kaalis ne prélève aucuns frais sur les dépôts et n’applique aucun écart de change : le montant est déposé en dollars canadiens.'
          }
          confirmLabel="Déposer"
          onConfirm={() => void submit()}
          pending={pending}
          error={submitError}
        />
      ) : null}

      <Sheet
        open={wireOpen}
        onClose={() => setWireOpen(false)}
        title="Instructions de virement"
        footer={
          <Button variant="ghost" block onClick={() => setWireOpen(false)}>
            Fermer
          </Button>
        }
      >
        <p className={styles.wireIntro}>Transmettez ces coordonnées à l’institution qui envoie les fonds. Le dépôt arrive dans votre compte Chèque en 1 à 2 jours ouvrables.</p>
        {details.error && !details.data ? (
          <ErrorState compact error={details.error} onRetry={() => void details.refetch()} />
        ) : (
          <dl className={styles.wireRows}>
            {details.data
              ? wireRows.map((row) => (
                  <div key={row.label} className={styles.wireRow}>
                    <dt className={styles.wireLabel}>{row.label}</dt>
                    <dd className={styles.wireValue}>
                      <span className={row.mono ? styles.mono : undefined}>{row.value}</span>
                      <Button variant="ghost" iconOnly aria-label={`Copier ${row.short}`} onClick={() => void copy(row.value, row.short)}>
                        <Icon name="copy" size={18} />
                      </Button>
                    </dd>
                  </div>
                ))
              : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={styles.wireRow}>
                    <Skeleton width="40%" height={12} />
                    <Skeleton width="60%" height={16} />
                  </div>
                ))}
          </dl>
        )}
      </Sheet>
    </div>
  )
}

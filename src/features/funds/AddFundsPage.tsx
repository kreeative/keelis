/**
 * Ajouter des fonds. Sur mobile, deux temps : d’abord d’où vient l’argent et où il va,
 * ensuite combien. À partir de 1024 px — le point où le kit demande de regrouper une
 * tâche plutôt que de la dérouler, parce qu’un clavier et une souris vont plus vite
 * qu’un assistant — les trois champs tiennent dans un seul formulaire.
 * Les frais, la limite quotidienne et le délai sont affichés avant la confirmation ;
 * la confirmation mène à la page de statut.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, IDS } from '@/api'
import { ApiError, type AccountDetails, type FundingSource } from '@/api/types'
import { Badge, Button, Callout, ChoiceList, EmptyState, ErrorState, Icon, List, ListRow, Money, PageHeader, SegmentedControl, Sheet, Skeleton, SkeletonRow, type IconName } from '@/components'
import { AmountEntry, ConfirmSheet, useAccounts } from '@/features/shared'
import { formatMoney, parseAmountInput } from '@/lib/format'
import { QK, useLargeScreen, useQuery, useSettings, useToast } from '@/store'
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

/* Quick amounts someone would actually deposit in francs. 1 000 F CFA is a euro and a
   half — these were authored when the app was Canadian. */
const PRESETS = [25_000, 50_000, 100_000, 250_000]

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
  /* Three screens on a phone, not one: montant → aperçu → confirmation. Seeing the
     summary while the keypad is still up means reading a total that is still changing —
     and it pushed the recap under the fold anyway. On a large screen the whole task is one
     form, as the kit's « optimize for devices » rule has it, so `grouped` skips the step. */
  const [step, setStep] = useState<'amount' | 'review'>('amount')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)
  const [wireOpen, setWireOpen] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)

  /** The kit's « large » breakpoint: group the steps instead of stepping through them. */
  const grouped = useLargeScreen()

  const target = DESTINATIONS.find((d) => d.value === destination) ?? DESTINATIONS[0]!
  const account = accounts.data?.find((a) => a.id === target.accountId)
  const source = sources.data?.find((s) => s.id === sourceId) ?? null
  const value = useMemo(() => parseAmountInput(amount), [amount])
  const fee = source ? Math.round(value * source.feePct * 100) / 100 : 0
  const total = value + fee

  const details = useQuery<AccountDetails>(wireOpen ? QK.accountDetails(IDS.checking) : null, () => api.accounts.details(IDS.checking), { staleTime: 60_000 })

  const choose = (id: string) => {
    setSourceId(id)
    setStep('amount')
    setAmountError(null)
    setSourceError(null)
    setSubmitError(null)
  }

  const validate = (): boolean => {
    if (!source) {
      setSourceError('Choisissez une provenance.')
      return false
    }
    setSourceError(null)
    if (!(value > 0)) {
      setAmountError('Entrez un montant.')
      return false
    }
    if (value > source.limitPerDay) {
      setAmountError(`Limite quotidienne : ${formatMoney(source.limitPerDay, { locale })}`)
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
      <PageHeader close back={-1} title="Ajouter des fonds" eyebrow={grouped ? undefined : `Étape ${!source ? 1 : step === 'amount' ? 2 : 3} sur 3`} />

      <div className={styles.layout}>
        <div className={styles.main}>
          {source && !grouped ? (
            <section className={styles.chosen} aria-label="Source sélectionnée">
              <Badge tone="neutral" icon={<Icon name={SOURCE_ICONS[source.kind]} size={14} />}>
                {source.label}
              </Badge>
              <Button variant="ghost" onClick={() => { setSourceId(null); setStep('amount') }}>
                Changer
              </Button>
            </section>
          ) : null}

          {!source || grouped ? (
            <>
              <section className={styles.block} aria-labelledby="funds-destination">
                <h2 id="funds-destination" className="t-section">
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
                <h2 id="funds-sources" className="t-section">
                  Provenance
                </h2>
                {sources.error && !sources.data ? (
                  <ErrorState error={sources.error} onRetry={() => void sources.refetch()} />
                ) : sources.loading ? (
                  <SkeletonRow count={4} />
                ) : sources.data && sources.data.length === 0 ? (
                  <EmptyState compact message="Aucune source de fonds n’est reliée à votre compte pour l’instant." />
                ) : grouped ? (
                  /* Everything is on screen at once, so the list keeps its selection
                     visible rather than navigating away from it. */
                  <ChoiceList
                    label="Provenance des fonds"
                    value={sourceId}
                    onChange={choose}
                    options={(sources.data ?? []).map((s) => ({
                      value: s.id,
                      title: s.label,
                      subtitle: `${s.mask} · ${s.eta}`,
                      label: `${s.label}, ${s.mask}, ${s.eta}`,
                      leading: (
                        <span className={styles.circle} aria-hidden="true">
                          <Icon name={SOURCE_ICONS[s.kind]} size={20} />
                        </span>
                      ),
                    }))}
                  />
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
                {sourceError ? <Callout icon="circle-alert">{sourceError}</Callout> : null}
              </section>
            </>
          ) : null}

          {(source && (grouped || step === 'amount')) || grouped ? (
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
                secondary={
                  source
                    ? `Limite quotidienne : ${formatMoney(source.limitPerDay, { locale })} · Délai : ${source.eta}`
                    : 'La limite et le délai dépendent de la provenance choisie.'
                }
                error={amountError}
                calculator
              />
              {!grouped ? (
                <div className={styles.stepActions}>
                  <Button size="lg" block onClick={() => { if (validate()) setStep('review') }}>
                    Continuer
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className={styles.aside}>
          {(source && (grouped || step === 'review')) ? (
            <>
              <h2 className="t-section">Aperçu</h2>
              <List>
                {/* The amount leads, because splitting the keypad off this screen took away
                    the only place it was visible — a summary you confirm without the sum on
                    it is worse than no summary. */}
                <ListRow static title="Montant" value={<Money value={value} unmasked />} />
                <ListRow static title="Source" subtitle={source?.mask} value={source ? source.label : '—'} />
                <ListRow
                  static
                  title="Destination"
                  subtitle={account ? <>Solde : <Money value={account.balance} /></> : undefined}
                  value={target.name.replace('Compte ', '')}
                />
                <ListRow static title="Frais" value={source ? <Money value={fee} unmasked /> : '—'} />
                <ListRow static title="Délai" value={source ? source.eta : '—'} />
              </List>
              <div className={styles.asideActions}>
                <Button
                  size="lg"
                  block
                  onClick={() => {
                    if (validate()) setConfirmOpen(true)
                  }}
                >
                  {grouped ? 'Continuer' : 'Confirmer le dépôt'}
                </Button>
                {!grouped ? (
                  <Button variant="ghost" block onClick={() => setStep('amount')}>
                    Modifier le montant
                  </Button>
                ) : null}
                {source?.kind === 'wire' ? (
                  <Button variant="ghost" block onClick={() => setWireOpen(true)}>
                    Instructions de virement
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2 className="t-section">{target.name}</h2>
              {accounts.error && !account ? (
                <ErrorState compact error={accounts.error} onRetry={() => void accounts.refetch()} />
              ) : (
                <>
                  <div className={styles.balance}>
                    {account ? <Money value={account.balance} className={styles.balanceValue} /> : <Skeleton width="60%" height="var(--fs-h2)" />}
                    <p className={styles.balanceCaption}>Solde actuel</p>
                  </div>
                  <p className={styles.asideNote}>Les fonds arrivent dans ce compte, puis se déplacent librement entre vos comptes Keelis, sans frais.</p>
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
              : 'Keelis ne prélève aucuns frais sur les dépôts et n’applique aucun écart de change : le montant est déposé en dollars canadiens.'
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

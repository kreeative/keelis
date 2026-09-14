/**
 * /crypto/:id/acheter · /crypto/:id/vendre
 * AmountEntry (fiat ↔ crypto) → fee preview (always visible) → quote → ConfirmSheet with a 30 s
 * countdown → order → SuccessScreen whose status settles live via the transaction cache.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api'
import type { AmountMode, ApiError, Order, QuoteRequest, Quote, RiskProfile } from '@/api/types'
import { Button, Callout, ErrorState, Money, PageHeader, SkeletonAmount } from '@/components'
import { AmountEntry, ConfirmSheet, SuccessScreen } from '@/features/shared'
import { DEFAULT_CURRENCY, formatCrypto, formatMoney, parseAmountInput } from '@/lib/format'
import { QK, useMutation, useQuery, useSettings } from '@/store'
import { cn } from '@/lib/cn'
import { floorTo, formatRate, toKeypadRaw } from './cryptoFormat'
import { useLiveAccount, useLiveAsset, useLiveHoldings, useLiveTransaction } from './hooks'
import styles from './TradePage.module.css'

type Side = 'buy' | 'sell'

function FeeLine({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn(styles.line, strong && styles.lineStrong)}>
      <dt className={styles.lineLabel}>{label}</dt>
      <dd className={styles.lineValue}>{value}</dd>
    </div>
  )
}

function TradeSuccess({ order, side, assetId }: { order: Order; side: Side; assetId: string }) {
  const { locale } = useSettings()
  const tx = useLiveTransaction(order.transactionId)
  const settled = tx.data?.status === 'posted'
  const failed = tx.data?.status === 'failed' || tx.data?.status === 'reversed'
  const q = order.quote
  const quantity = formatCrypto(q.quantity, q.symbol, { locale })
  return (
    <SuccessScreen
      title={side === 'buy' ? 'Achat effectué' : 'Vente effectuée'}
      hero={side === 'buy' ? quantity : <Money value={q.total} unmasked />}
      caption={side === 'buy' ? `pour ${formatMoney(q.total, { locale })}` : `${quantity} vendus`}
      status={failed ? 'Échouée' : settled ? 'Réglé' : 'En attente'}
      details={[
        { label: "Prix d'exécution", value: <Money value={q.executionPrice} unmasked /> },
        { label: 'Écart (spread)', value: `${formatRate(q.spreadPct, locale)} · ${formatMoney(q.spreadAmount, { locale })}` },
        { label: 'Frais', value: <Money value={q.fee} unmasked /> },
        { label: 'Total', value: <Money value={q.total} unmasked /> },
      ]}
      primaryLabel={`Voir ${q.symbol}`}
      primaryTo={`/crypto/${assetId}`}
      secondaryLabel="Retour à l'accueil"
      secondaryTo="/"
    />
  )
}

export default function TradePage({ side }: { side: Side }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { locale } = useSettings()
  const assetQ = useLiveAsset(id)
  const asset = assetQ.data
  const checking = useLiveAccount('checking')
  const holdings = useLiveHoldings()
  const holding = holdings.data?.find((h) => h.assetId === id)
  const hasHolding = !!holding && holding.quantity > 0

  const [mode, setMode] = useState<AmountMode>('fiat')
  const [raw, setRaw] = useState('')
  const [serverError, setServerError] = useState<ApiError | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)

  const risk = useQuery<RiskProfile | null>(QK.risk, () => api.profile.risk(), { staleTime: 5 * 60_000 })
  const quoteM = useMutation((req: QuoteRequest) => api.crypto.quote(req))
  const orderM = useMutation((quoteId: string) => api.crypto.placeOrder(quoteId))

  // Quote countdown (30 s validity).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sheetOpen || !quote) return
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(iv)
  }, [sheetOpen, quote])

  const symbol = asset?.symbol ?? ''
  const decimals = asset?.decimals ?? 8
  const price = asset?.price ?? 0
  const spread = asset?.spreadPct ?? 0
  const exec = side === 'buy' ? price * (1 + spread) : price * (1 - spread)
  const typed = parseAmountInput(raw)
  /**
   * The preview has to agree with the order.
   *
   * It used to divide the amount by the price and show whatever fell out — « ≈ 1.6976
   * SNTS » for 50 000 F CFA, with a total of 50 000 on the confirmation sheet — while the
   * server quoted one whole share for 29 453. The sheet promised one thing and the receipt
   * delivered another, which is the worst contradiction a money screen can carry. The
   * asset's own `decimals` decides here exactly as it does there: rounded down on a buy,
   * and the total recomputed from the quantity actually traded.
   */
  const step = 10 ** -decimals
  const toStep = (n: number, down: boolean) => (down ? Math.floor(n / step + 1e-9) : Math.round(n / step)) * step
  const quantity = mode === 'fiat' ? (exec > 0 ? toStep(typed / exec, true) : 0) : toStep(typed, false)
  const total = mode === 'fiat' ? Math.round(quantity * exec * 100) / 100 : Math.round(typed * exec * 100) / 100
  const spreadAmount = Math.abs(exec - price) * quantity
  const minTrade = asset?.minTrade ?? 0

  const clientError = (() => {
    if (typed <= 0) return null
    if (side === 'buy' && checking.data && total > checking.data.balance + 1e-9) return 'Solde Chèque insuffisant'
    if (side === 'sell') {
      if (holdings.data && !hasHolding) return `Vous ne détenez pas de ${symbol}`
      if (holding && quantity > holding.quantity + 1e-9) return 'Quantité supérieure à vos avoirs'
    }
    if (total < minTrade) return `Montant minimum : ${formatMoney(minTrade, { locale })}`
    // An indivisible asset needs enough for one whole unit, and the sentence says how much.
    if (mode === 'fiat' && quantity <= 0) return `${asset?.name ?? symbol} cote ${formatMoney(price, { locale })}. Il faut de quoi en acheter au moins une unité.`
    return null
  })()
  /**
   * The one thing the risk profile changes: a sentence before a volatile buy.
   *
   * Only on a buy — nobody needs warning about getting out — only on the volatile end of
   * the list, and only for somebody whose own answers said they might need this money soon.
   * Somebody who has not answered is not nagged: an unfilled questionnaire is not a
   * statement about them.
   */
  const riskNote = (() => {
    if (side !== 'buy' || asset?.assetClass !== 'crypto') return null
    const level = risk.data?.level
    if (level !== 'prudent' && level !== 'equilibre') return null
    return level === 'prudent'
      ? 'Vous vous êtes décrit comme prudent, et cet actif peut perdre la moitié de sa valeur en quelques semaines. Rien ne vous en empêche.'
      : 'Cet actif est volatil : sa valeur peut varier fortement d’une semaine à l’autre.'
  })()

  const entryError = serverError?.message ?? clientError
  const insufficientFunds = side === 'buy' && (clientError === 'Solde Chèque insuffisant' || serverError?.code === 'insufficient_funds')
  const canContinue = !!asset && typed > 0 && !clientError && !quoteM.pending

  const available =
    side === 'buy'
      ? checking.data
        ? `Disponible : ${formatMoney(checking.data.balance, { locale })}`
        : undefined
      : holdings.data
        ? `Disponible : ${formatCrypto(holding?.quantity ?? 0, symbol, { locale })}`
        : undefined
  /* On an indivisible asset the quantity is exact, not approximate — and the line says
     what it will really cost, which is not always what was typed. */
  const exact = decimals === 0
  const secondary =
    typed > 0
      ? mode === 'fiat'
        ? `${exact ? '' : '≈ '}${formatCrypto(quantity, symbol, { locale })}${exact && total !== typed ? ` · ${formatMoney(total, { locale })}` : ''}`
        : `≈ ${formatMoney(total, { locale })}`
      : available

  const onChange = (v: string) => {
    setRaw(v)
    if (serverError) setServerError(null)
  }

  const toggleMode = () => {
    const next: AmountMode = mode === 'fiat' ? 'crypto' : 'fiat'
    if (typed > 0 && exec > 0) setRaw(next === 'crypto' ? toKeypadRaw(quantity, decimals) : toKeypadRaw(floorTo(total, 2), 2))
    setMode(next)
    setServerError(null)
  }

  const onMax = () => {
    if (side === 'buy') {
      const bal = checking.data?.balance ?? 0
      setRaw(mode === 'fiat' ? toKeypadRaw(floorTo(bal, 2), 2) : toKeypadRaw(exec > 0 ? floorTo(bal / exec, decimals) : 0, decimals))
    } else {
      const q = holding?.quantity ?? 0
      setRaw(mode === 'crypto' ? toKeypadRaw(q, decimals) : toKeypadRaw(floorTo(q * exec, 2), 2))
    }
    setServerError(null)
  }

  const requestQuote = async (): Promise<Quote | null> => {
    if (!asset) return null
    setServerError(null)
    try {
      const q = await quoteM.mutate({ assetId: id, side, mode, amount: typed })
      orderM.reset()
      setQuote(q)
      return q
    } catch (err) {
      setServerError(err as ApiError)
      setSheetOpen(false)
      return null
    }
  }

  const onContinue = async () => {
    const q = await requestQuote()
    if (q) setSheetOpen(true)
  }

  const remaining = quote ? Math.max(0, Math.ceil((new Date(quote.expiresAt).getTime() - now) / 1000)) : 0
  const expired = !!quote && (remaining <= 0 || orderM.error?.code === 'validation')

  const onConfirm = async () => {
    if (!quote) return
    if (expired) {
      await requestQuote()
      return
    }
    try {
      const o = await orderM.mutate(quote.id)
      setSheetOpen(false)
      setOrder(o)
    } catch {
      /* shown inline in the sheet */
    }
  }

  if (order) {
    return (
      <div className={cn('page', styles.trade)}>
        <TradeSuccess order={order} side={side} assetId={id} />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className={cn('page', styles.trade)}>
        <PageHeader close back={`/crypto/${id}`} title={side === 'buy' ? 'Acheter' : 'Vendre'} className={styles.head} />
        {assetQ.error ? <ErrorState error={assetQ.error} onRetry={() => void assetQ.refetch()} /> : <SkeletonAmount />}
      </div>
    )
  }

  const rate = formatRate(spread, locale)
  const verb = side === 'buy' ? 'Acheter' : 'Vendre'

  return (
    <div className={cn('page', styles.trade)}>
      <PageHeader close back={`/crypto/${id}`} title={`${verb} ${asset.symbol}`} eyebrow={`Prix : ${formatMoney(asset.price, { locale })}`} className={styles.head} />

      <div className={styles.entry}>
        <AmountEntry
          label={`Montant à ${side === 'buy' ? 'acheter' : 'vendre'}`}
          value={raw}
          onChange={onChange}
          mode={mode}
          unit={mode === 'fiat' ? DEFAULT_CURRENCY : asset.symbol}
          secondary={secondary}
          onToggleMode={toggleMode}
          error={entryError}
          /* Francs, and on the scale of the things being bought: a share of Sonatel is
             29 190 F CFA, so presets of 25, 50, 100 and 250 bought nothing at all. */
          presets={mode === 'fiat' ? [25_000, 50_000, 100_000, 250_000] : undefined}
          onMax={onMax}
          maxDecimals={mode === 'fiat' ? 2 : decimals}
          disabled={quoteM.pending}
        />
      </div>

      {/* Warn before, not after. A profile the person filled in themselves decides whether
          this appears; it never blocks the order, and it sits beside the amount rather than
          in the confirmation sheet, while the decision is still open. */}
      {riskNote ? (
        <Callout variant="note" className={styles.riskNote}>
          {riskNote}
        </Callout>
      ) : null}

      <dl className={styles.fees} aria-label="Aperçu des frais">
        <FeeLine label="Prix du marché" value={<Money value={price} unmasked />} />
        <FeeLine label="Écart (spread)" value={`${rate} · ${formatMoney(spreadAmount, { locale })}`} />
        <FeeLine label="Frais" value={<Money value={0} unmasked />} />
        <FeeLine label="Total" value={<Money value={total} unmasked />} strong />
      </dl>

      <div className={styles.cta}>
        {insufficientFunds ? (
          <Button variant="ghost" block onClick={() => navigate('/fonds')}>
            Ajouter des fonds
          </Button>
        ) : null}
        <Button size="lg" block disabled={!canContinue} loading={quoteM.pending && !sheetOpen} onClick={() => void onContinue()}>
          Continuer
        </Button>
      </div>

      {quote ? (
        <ConfirmSheet
          open={sheetOpen}
          onClose={() => {
            if (orderM.pending || quoteM.pending) return
            setSheetOpen(false)
          }}
          title={side === 'buy' ? "Confirmer l'achat" : 'Confirmer la vente'}
          hero={side === 'buy' ? formatCrypto(quote.quantity, quote.symbol, { locale }) : <Money value={quote.total} unmasked />}
          heroCaption={side === 'buy' ? `pour ${formatMoney(quote.total, { locale })}` : `pour ${formatCrypto(quote.quantity, quote.symbol, { locale })}`}
          lines={[
            { label: "Prix d'exécution", value: <Money value={quote.executionPrice} unmasked /> },
            { label: 'Quantité', value: formatCrypto(quote.quantity, quote.symbol, { locale }) },
            { label: 'Écart (spread)', value: `${formatRate(quote.spreadPct, locale)} · ${formatMoney(quote.spreadAmount, { locale })}` },
            { label: 'Frais', value: <Money value={quote.fee} unmasked /> },
            { label: 'Total', value: <Money value={quote.total} unmasked />, strong: true },
            { label: 'Délai', value: 'Instantané' },
          ]}
          note={expired ? 'Cotation expirée — Actualiser pour obtenir un nouveau prix.' : `Le prix inclut un écart de ${formatRate(quote.spreadPct, locale)}. Cotation valable ${remaining} s.`}
          confirmLabel={expired ? 'Actualiser la cotation' : side === 'buy' ? "Confirmer l'achat" : 'Confirmer la vente'}
          onConfirm={() => void onConfirm()}
          pending={orderM.pending || quoteM.pending}
          error={expired ? null : orderM.error}
        />
      ) : null}
    </div>
  )
}

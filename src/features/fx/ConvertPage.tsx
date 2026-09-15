/**
 * Convertir — change one currency for another, with the spread stated before the user
 * commits rather than hidden inside a worse rate.
 *
 * The screen shows three numbers that a conversion screen usually shows only one of: the
 * unmarked rate, the rate actually applied, and the spread as money in the currency being
 * sold. Someone comparing Keewal Meere against a bureau de change on the corner can only do it
 * if all three are on screen.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import { ApiError } from '@/api/types'
import { Button, Callout, Card, Icon, SelectField, Sheet, StatGrid } from '@/components'
import { AmountEntry, StepFlow, SuccessScreen, useAccount, type FlowStep } from '@/features/shared'
import { CURRENCIES, CURRENCY_ORDER, isCurrency, type Currency } from '@/lib/currency'
import { TIER_LABEL, quote } from '@/lib/fx'
import { formatMoney, formatNumber, parseAmountInput } from '@/lib/format'
import { QK, invalidate, useSettings } from '@/store'
import styles from './ConvertPage.module.css'

export default function ConvertPage() {
  const { locale } = useSettings()
  const account = useAccount('checking')

  /* A pocket row on Chèque links here with `?de=EUR`: arriving on the wrong currency and
     making the person change it is the sort of small rudeness that adds up. */
  const [params, setParams] = useSearchParams()
  const initial = params.get('de')
  const [from, setFrom] = useState<Currency>(initial && isCurrency(initial) ? initial : 'XOF')
  const [to, setTo] = useState<Currency>(initial === 'XOF' || !initial ? 'EUR' : 'XOF')
  const [raw, setRaw] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [done, setDone] = useState<{ gave: number; got: number; from: Currency; to: Currency } | null>(null)

  /** What the account actually holds in the currency being sold. */
  const held = useMemo(() => {
    const a = account.data
    if (!a) return undefined
    if (a.currency === from) return a.balance
    return a.pockets?.find((p) => p.currency === from)?.amount ?? 0
  }, [account.data, from])

  const amount = parseAmountInput(raw)
  const q = useMemo(() => quote(from, to, amount), [from, to, amount])
  const money = (v: number, c: Currency) => formatMoney(v, { locale, currency: c })

  /**
   * Quote the pair in the direction that produces a readable number.
   *
   * XOF → EUR is 0,0015244 at the market and 0,0015061 after the spread: rounded for
   * display, both read "0,0015" and the margin looks like nothing. Quoted the other way
   * round — 655,96 against 663,92 francs to the euro — the same spread is plainly there.
   * This is how a bureau de change writes it on the board, and for the same reason.
   */
  const rateLine = (rate: number, exact = false) => {
    const invert = rate < 1
    const shown = invert ? 1 / rate : rate
    const [a, b] = invert ? [to, from] : [from, to]
    /* The peg is exact, and rounding it to 655.96 quietly contradicts the sentence beside
       it. Three decimals for that one pair; everything else is a quote, and a quote does
       not deserve a precision it does not have. */
    const maxFraction = exact ? 3 : shown < 10 ? 4 : 2
    return `1 ${a} = ${formatNumber(shown, { locale, maxFraction, minFraction: exact ? 3 : 0 })} ${b}`
  }
  /* Exact only for the pair the treaty fixes: a CFA franc against the euro. XOF→USD runs
     through that peg but is not itself fixed, so it stays a quote. */
  const exactPeg = (CURRENCIES[from].pegged === true && to === 'EUR') || (CURRENCIES[to].pegged === true && from === 'EUR')
  const rateText = rateLine(q.rate)

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const sameCurrency = from === to
  const tooMuch = held !== undefined && amount > held
  const canConvert = amount > 0 && !sameCurrency && !tooMuch && !!account.data

  /**
   * This used to close the sheet, show a toast reading « converti », and navigate home —
   * **without moving anything**. No balance changed and no transaction was recorded: the
   * app told somebody their money had moved when it had not, which is the one thing a
   * money product may never do. It calls the API now, and the success screen is the
   * receipt for something that happened.
   */
  const confirm = async () => {
    if (!account.data) return
    setPending(true)
    setError(null)
    try {
      await api.fx.convert({ accountId: account.data.id, from, to, amount })
      invalidate(QK.accounts)
      setConfirming(false)
      setDone({ gave: q.amountIn, got: q.amountOut, from, to })
      setRaw('')
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('La conversion n’a pas pu être effectuée.', 'unknown'))
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="page">
        <SuccessScreen
          title="Conversion effectuée"
          hero={money(done.got, done.to)}
          caption={`Depuis ${money(done.gave, done.from)}`}
          details={[
            { label: 'Taux appliqué', value: rateText },
            { label: 'Marge', value: money(q.feeIn, done.from) },
          ]}
          primaryLabel="Terminé"
          primaryTo="/carte"
          secondaryLabel="Convertir encore"
          /* Not `secondaryTo="/convertir"`: we are already on that route, so navigating to
             it changes nothing and the button appears dead. The receipt is local state,
             and clearing it is what actually goes back to the form. */
          /* Clearing the receipt starts a *new* conversion, so it starts at step one.
             Without this the flow came back on the aperçu of the conversion just made —
             the step is in the URL, and the URL still said so. */
          onSecondary={() => {
            setDone(null)
            setParams(
              (prev) => {
                const p = new URLSearchParams(prev)
                p.delete('etape')
                return p
              },
              { replace: true },
            )
          }}
        />
      </div>
    )
  }

  const steps: FlowStep[] = [
    {
      id: 'convert-pair',
      title: 'Devises',
      content: (
        <>
          <p className={styles.intro}>Le taux appliqué et la marge sont affichés avant que vous confirmiez.</p>
          <Card padding="md" elevation={1} className={styles.pair}>
            <SelectField label="De" value={from} onChange={(e) => setFrom(e.target.value as Currency)}>
              {CURRENCY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {c} — {CURRENCIES[c].name}
                </option>
              ))}
            </SelectField>

            <Button variant="secondary" iconOnly aria-label="Inverser les devises" onClick={swap} className={styles.swap}>
              <Icon name="transfer" />
            </Button>

            <SelectField label="Vers" value={to} onChange={(e) => setTo(e.target.value as Currency)}>
              {CURRENCY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {c} — {CURRENCIES[c].name}
                </option>
              ))}
            </SelectField>
          </Card>
        </>
      ),
      nextDisabled: sameCurrency,
    },
    {
      id: 'convert-amount',
      title: 'Montant à convertir',
      content: (
        <AmountEntry
          label="Montant à convertir"
          value={raw}
          onChange={setRaw}
          unit={from}
          maxDecimals={CURRENCIES[from].decimals}
          calculator
          secondary={sameCurrency ? undefined : held !== undefined ? `Disponible : ${money(held, from)} · vous recevez ${money(q.amountOut, to)}` : `Vous recevez ${money(q.amountOut, to)}`}
          onMax={held !== undefined && held > 0 ? () => setRaw(String(held).replace('.', ',')) : undefined}
          error={sameCurrency ? 'Choisissez deux devises différentes.' : tooMuch ? `Vous détenez ${money(held ?? 0, from)} en ${from}.` : (error?.message ?? null)}
        />
      ),
      nextDisabled: !canConvert,
    },
    {
      id: 'convert-review',
      title: 'Aperçu',
      content: (
        <>
          {/* Both rates and the margin, before anything is committed. This is the page's
              whole promise: « the spread is stated, never buried in a worse rate ». */}
          <Card padding="md" elevation={1} className={styles.detail}>
            <StatGrid
              label="Détail de la conversion"
              stats={[
                { label: 'Taux du marché', value: rateLine(q.midRate, exactPeg) },
                { label: 'Taux appliqué', value: rateText },
                { label: `Marge (${formatNumber(q.spread * 100, { locale, maxFraction: 2 })} %)`, value: money(q.feeIn, from) },
                { label: 'Vous donnez', value: money(q.amountIn, from) },
                { label: 'Vous recevez', value: money(q.amountOut, to) },
              ]}
            />
          </Card>

          {q.pegged && CURRENCIES[from].pegged && CURRENCIES[to].pegged ? (
            <Callout variant="panel" icon="info" title="Parité fixe">
              Le franc CFA d’Afrique de l’Ouest (XOF) et celui d’Afrique centrale (XAF) partagent le même
              arrimage à l’euro : le taux entre eux est exactement 1 pour 1 et ne bouge pas. Ils sont
              toutefois émis par deux banques centrales différentes, d’où la marge de transfert.
            </Callout>
          ) : (
            <Callout variant="note" icon="info">
              {TIER_LABEL[q.tier]}. Les taux affichés sont des taux de démonstration, pas une cotation de marché.
            </Callout>
          )}
        </>
      ),
    },
  ]

  return (
    <div className="page">
      <StepFlow title="Convertir" exit="/" steps={steps} onFinish={() => setConfirming(true)} finishLabel="Convertir" finishDisabled={!canConvert} />

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Confirmer la conversion"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>Annuler</Button>
            <Button onClick={() => void confirm()} loading={pending}>Confirmer</Button>
          </>
        }
      >
        <StatGrid
          label="Récapitulatif"
          stats={[
            { label: 'Vous donnez', value: money(q.amountIn, from) },
            { label: 'Taux appliqué', value: rateText },
            { label: `Marge (${formatNumber(q.spread * 100, { locale, maxFraction: 2 })} %)`, value: money(q.feeIn, from) },
            { label: 'Vous recevez', value: money(q.amountOut, to) },
          ]}
        />
      </Sheet>
    </div>
  )
}

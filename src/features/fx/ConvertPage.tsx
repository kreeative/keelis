/**
 * Convertir — change one currency for another, with the spread stated before the user
 * commits rather than hidden inside a worse rate.
 *
 * The screen shows three numbers that a conversion screen usually shows only one of: the
 * unmarked rate, the rate actually applied, and the spread as money in the currency being
 * sold. Someone comparing Keelis against a bureau de change on the corner can only do it
 * if all three are on screen.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Callout, Card, Icon, PageHeader, SelectField, Sheet, StatGrid } from '@/components'
import { AmountEntry } from '@/features/shared'
import { CURRENCIES, CURRENCY_ORDER, type Currency } from '@/lib/currency'
import { TIER_LABEL, quote } from '@/lib/fx'
import { formatMoney, formatNumber, parseAmountInput } from '@/lib/format'
import { useSettings, useToast } from '@/store'
import styles from './ConvertPage.module.css'

export default function ConvertPage() {
  const navigate = useNavigate()
  const { locale } = useSettings()
  const { toast } = useToast()

  const [from, setFrom] = useState<Currency>('XOF')
  const [to, setTo] = useState<Currency>('EUR')
  const [raw, setRaw] = useState('')
  const [confirming, setConfirming] = useState(false)

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
  const rateLine = (rate: number) => {
    const invert = rate < 1
    const shown = invert ? 1 / rate : rate
    const [a, b] = invert ? [to, from] : [from, to]
    return `1 ${a} = ${formatNumber(shown, { locale, maxFraction: shown < 10 ? 4 : 2 })} ${b}`
  }
  const rateText = rateLine(q.rate)

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const sameCurrency = from === to
  const canConvert = amount > 0 && !sameCurrency

  const confirm = () => {
    setConfirming(false)
    setRaw('')
    toast(`${money(q.amountIn, from)} converti en ${money(q.amountOut, to)}`)
    navigate('/accueil')
  }

  return (
    <div className="page">
      <PageHeader title="Convertir" back={-1} />
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

      <AmountEntry
        label="Montant à convertir"
        value={raw}
        onChange={setRaw}
        unit={from}
        maxDecimals={CURRENCIES[from].decimals}
        secondary={sameCurrency ? undefined : `Vous recevez ${money(q.amountOut, to)}`}
        error={sameCurrency ? 'Choisissez deux devises différentes.' : null}
      />

      <Card padding="md" elevation={1} className={styles.detail}>
        <StatGrid
          label="Détail de la conversion"
          stats={[
            { label: 'Taux du marché', value: rateLine(q.midRate) },
            { label: 'Taux appliqué', value: rateText },
            { label: `Marge (${formatNumber(q.spread * 100, { locale, maxFraction: 2 })} %)`, value: money(q.feeIn, from) },
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

      <div className={styles.actions}>
        <Button size="lg" disabled={!canConvert} onClick={() => setConfirming(true)}>
          Continuer
        </Button>
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Confirmer la conversion"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Annuler</Button>
            <Button onClick={confirm}>Confirmer</Button>
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

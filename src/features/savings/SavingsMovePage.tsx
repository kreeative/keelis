/**
 * /epargne/deposer · /epargne/retirer
 * AmountEntry → aperçu (frais et délai toujours visibles) → ConfirmSheet → SuccessScreen
 * dont le statut passe de « En attente » à « Réglé » via le cache des transactions.
 */
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import type { ApiError, MoneyMovementResult } from '@/api/types'
import { Button, Money, PageHeader } from '@/components'
import { AmountEntry, ConfirmSheet, SuccessScreen, useAccount, useAccountId, useSavings, useTransaction } from '@/features/shared'
import { formatMoney, parseAmountInput } from '@/lib/format'
import { useMutation, useSettings } from '@/store'
import { cn } from '@/lib/cn'
import { estimateInterest, floorTo, formatApy, toKeypadRaw } from './savingsUtils'
import styles from './SavingsMovePage.module.css'

type Direction = 'deposit' | 'withdraw'

function Line({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn(styles.line, strong && styles.lineStrong)}>
      <dt className={styles.lineLabel}>{label}</dt>
      <dd className={styles.lineValue}>{value}</dd>
    </div>
  )
}

function MoveSuccess({ result, amount, deposit }: { result: MoneyMovementResult; amount: number; deposit: boolean }) {
  const tx = useTransaction(result.transactionId)
  const savings = useAccount('savings')
  const settled = tx.data?.status === 'posted'
  const failed = tx.data?.status === 'failed' || tx.data?.status === 'reversed'
  return (
    <SuccessScreen
      title={deposit ? 'Dépôt effectué' : 'Retrait effectué'}
      hero={<Money value={amount} unmasked />}
      caption={deposit ? 'ajoutés à votre Épargne' : 'envoyés vers votre compte Chèque'}
      status={failed ? 'Échouée' : settled ? 'Réglé' : 'En attente'}
      details={[
        { label: 'De', value: deposit ? 'Chèque' : 'Épargne' },
        { label: 'Vers', value: deposit ? 'Épargne' : 'Chèque' },
        { label: 'Frais', value: <Money value={0} unmasked /> },
        { label: 'Délai', value: result.eta },
        { label: 'Solde Épargne', value: savings.data ? <Money value={savings.data.balance} unmasked /> : '—' },
      ]}
      primaryLabel="Terminé"
      primaryTo="/epargne"
      secondaryLabel="Voir la transaction"
      secondaryTo={`/transactions/${result.transactionId}`}
    />
  )
}

export default function SavingsMovePage({ direction }: { direction: Direction }) {
  const deposit = direction === 'deposit'
  const navigate = useNavigate()
  const { locale } = useSettings()
  const checking = useAccount('checking')
  const savingsAccount = useAccount('savings')
  const savings = useSavings()

  const [raw, setRaw] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [serverError, setServerError] = useState<ApiError | null>(null)
  const [result, setResult] = useState<MoneyMovementResult | null>(null)

  // The other end of the move is the chequing account, found by kind: the id is the
  // back-end's, and a movement sent to a hard-coded one would go nowhere real.
  const chequeId = useAccountId('checking')
  const move = useMutation((amount: number) => (deposit ? api.savings.deposit(amount, chequeId!) : api.savings.withdraw(amount, chequeId!)))

  const savingsBalance = savings.data?.balance ?? savingsAccount.data?.balance
  const checkingBalance = checking.data?.balance
  const source = deposit ? checkingBalance : savingsBalance
  const apy = savings.data?.apy ?? savingsAccount.data?.apy ?? 0

  const typed = parseAmountInput(raw)
  const clientError = typed > 0 && source !== undefined && typed > source + 1e-9 ? (deposit ? 'Solde Chèque insuffisant' : 'Solde Épargne insuffisant') : null
  const entryError = serverError?.message ?? clientError
  const insufficient = deposit && (clientError !== null || serverError?.code === 'insufficient_funds')
  // The chequing account has to be known: it is the other end of every move here.
  const canContinue = typed > 0 && !clientError && source !== undefined && chequeId !== undefined

  const newSavings = savingsBalance === undefined ? undefined : savingsBalance + (deposit ? typed : -typed)
  const secondary =
    typed > 0
      ? newSavings !== undefined
        ? `Nouveau solde Épargne : ${formatMoney(newSavings, { locale })}`
        : undefined
      : source !== undefined
        ? `Disponible : ${formatMoney(source, { locale })}`
        : undefined

  const interest = estimateInterest(typed, apy)

  const onChange = (v: string) => {
    setRaw(v)
    if (serverError) setServerError(null)
  }

  const onMax = () => {
    setRaw(toKeypadRaw(floorTo(source ?? 0)))
    setServerError(null)
  }

  const onConfirm = async () => {
    if (!chequeId) return
    try {
      const r = await move.mutate(typed)
      setSheetOpen(false)
      setResult(r)
    } catch (err) {
      setServerError(err as ApiError)
    }
  }

  if (result) {
    return (
      <div className={cn('page', styles.move)}>
        <MoveSuccess result={result} amount={typed} deposit={deposit} />
      </div>
    )
  }

  return (
    <div className={cn('page', styles.move)}>
      <PageHeader
        close
        back="/epargne"
        title={deposit ? 'Déposer dans l’Épargne' : 'Retirer de l’Épargne'}
        eyebrow={deposit ? 'Depuis Chèque' : 'Vers Chèque'}
        level="h2"
        className={styles.head}
      />

      <div className={styles.entry}>
        <AmountEntry
          label={deposit ? 'Montant à déposer' : 'Montant à retirer'}
          value={raw}
          onChange={onChange}
          secondary={secondary}
          error={entryError}
          presets={[10_000, 25_000, 50_000, 100_000]}
          onMax={source !== undefined ? onMax : undefined}
          disabled={move.pending}
        />
      </div>

      <dl className={styles.preview} aria-label="Aperçu du virement">
        <Line label="De" value={deposit ? 'Chèque' : 'Épargne'} />
        <Line label="Vers" value={deposit ? 'Épargne' : 'Chèque'} />
        <Line label="Frais" value={<Money value={0} unmasked />} />
        <Line label="Délai" value="Instantané" />
        {deposit ? <Line label="Intérêts estimés sur 12 mois" value={<Money value={interest} unmasked />} /> : null}
      </dl>

      <div className={styles.cta}>
        {insufficient ? (
          <Button variant="ghost" block onClick={() => navigate('/fonds')}>
            Ajouter des fonds
          </Button>
        ) : null}
        <Button size="lg" block disabled={!canContinue} onClick={() => setSheetOpen(true)}>
          Continuer
        </Button>
      </div>

      <ConfirmSheet
        open={sheetOpen}
        onClose={() => {
          if (move.pending) return
          setSheetOpen(false)
        }}
        title={deposit ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
        hero={<Money value={typed} unmasked />}
        heroCaption={deposit ? 'de Chèque vers Épargne' : 'd’Épargne vers Chèque'}
        lines={[
          { label: 'De', value: deposit ? 'Chèque' : 'Épargne' },
          { label: 'Vers', value: deposit ? 'Épargne' : 'Chèque' },
          { label: 'Montant', value: <Money value={typed} unmasked /> },
          { label: 'Frais', value: <Money value={0} unmasked /> },
          { label: 'Total', value: <Money value={typed} unmasked />, strong: true },
          { label: 'Délai', value: 'Instantané' },
        ]}
        note={
          deposit
            ? `Aucuns frais. Au taux actuel de ${formatApy(apy, locale)}, ce dépôt rapporte environ ${formatMoney(interest, { locale })} sur 12 mois.`
            : `Aucuns frais. Les fonds retirés cessent de rapporter le taux de ${formatApy(apy, locale)}.`
        }
        confirmLabel={deposit ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
        onConfirm={() => void onConfirm()}
        pending={move.pending}
        error={move.error}
      />
    </div>
  )
}

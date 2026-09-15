/**
 * /epargne/deposer · /epargne/retirer
 * Montant (le clavier seul) → aperçu → ConfirmSheet → SuccessScreen.
 *
 * The keypad and the aperçu used to be the same screen: the fee, the delay and the
 * estimated interest sat under a total that was still being typed. `StepFlow` splits them.
 * dont le statut passe de « En attente » à « Réglé » via le cache des transactions.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import type { ApiError, MoneyMovementResult } from '@/api/types'
import { Button, Money } from '@/components'
import { AmountEntry, ConfirmSheet, ReviewList, StepFlow, SuccessScreen, useAccount, useAccountId, useSavings, useTransaction, type FlowStep, type SummaryLine } from '@/features/shared'
import { formatMoney, formatRate, parseAmountInput } from '@/lib/format'
import { useMutation, useSettings } from '@/store'
import { cn } from '@/lib/cn'
import { estimateInterest, floorTo, toKeypadRaw } from './savingsUtils'
import styles from './SavingsMovePage.module.css'

type Direction = 'deposit' | 'withdraw'


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

  /* One array, rendered on the aperçu screen and again in the sheet over it, so the two
     cannot describe the same movement differently. */
  const lines: SummaryLine[] = [
    { label: 'De', value: deposit ? 'Chèque' : 'Épargne' },
    { label: 'Vers', value: deposit ? 'Épargne' : 'Chèque' },
    { label: 'Montant', value: <Money value={typed} unmasked /> },
    { label: 'Frais', value: <Money value={0} unmasked /> },
    { label: 'Total', value: <Money value={typed} unmasked />, strong: true },
    { label: 'Délai', value: 'Instantané' },
    ...(deposit ? [{ label: 'Intérêts estimés sur 12 mois', value: <Money value={interest} unmasked /> }] : []),
  ]

  const note = deposit
    ? `Aucuns frais. Au taux actuel de ${formatRate(apy, locale)}, ce dépôt rapporte environ ${formatMoney(interest, { locale })} sur 12 mois.`
    : `Aucuns frais. Les fonds retirés cessent de rapporter le taux de ${formatRate(apy, locale)}.`

  const steps: FlowStep[] = [
    {
      id: 'move-amount',
      title: deposit ? 'Montant à déposer' : 'Montant à retirer',
      nextDisabled: !canContinue,
      content: (
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
      ),
      footer: insufficient ? (
        <Button variant="ghost" block onClick={() => navigate('/fonds')}>
          Ajouter des fonds
        </Button>
      ) : undefined,
    },
    {
      id: 'move-review',
      title: 'Aperçu',
      content: <ReviewList hero={<Money value={typed} unmasked />} heroCaption={deposit ? 'de Chèque vers Épargne' : 'd’Épargne vers Chèque'} lines={lines} note={note} />,
    },
  ]

  return (
    <div className={cn('page', styles.move)}>
      <StepFlow
        title={deposit ? 'Déposer dans l’Épargne' : 'Retirer de l’Épargne'}
        exit="/epargne"
        steps={steps}
        onFinish={() => setSheetOpen(true)}
        finishLabel={deposit ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
        finishDisabled={!canContinue}
      />

      <ConfirmSheet
        open={sheetOpen}
        onClose={() => {
          if (move.pending) return
          setSheetOpen(false)
        }}
        title={deposit ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
        hero={<Money value={typed} unmasked />}
        heroCaption={deposit ? 'de Chèque vers Épargne' : 'd’Épargne vers Chèque'}
        lines={lines}
        note={note}
        confirmLabel={deposit ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
        onConfirm={() => void onConfirm()}
        pending={move.pending}
        error={move.error}
      />
    </div>
  )
}

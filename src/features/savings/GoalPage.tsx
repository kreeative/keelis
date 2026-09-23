/**
 * /epargne/objectifs/nouveau — création guidée avec estimation en direct.
 * /epargne/objectifs/:id   — suivi d’un objectif : progression, versements, contribution, suppression.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api'
import type { ApiError, SavingsGoal } from '@/api/types'
import { AmountDisplay, Button, EmptyState, ErrorState, Field, Icon, Money, PageHeader, ProgressBar, Sheet, Skeleton } from '@/components'
import { AmountEntry, ConfirmSheet, useGoals, useSavings } from '@/features/shared'
import { DEFAULT_CURRENCY, formatDate, formatMoney, parseAmountInput, splitMoney } from '@/lib/format'
import { useMutation, useSettings, useToast } from '@/store'
import {
  dateInMonths,
  floorTo,
  formatMonthYear,
  formatWholePercent,
  goalPercent,
  goalProgress,
  inlineMoney,
  monthsToTarget,
  sanitizeAmountInput,
  toKeypadRaw,
  unallocated,
} from './savingsUtils'
import styles from './GoalPage.module.css'

type FieldKey = 'name' | 'target' | 'monthly' | 'initial'

function monthsLabel(months: number): string {
  return months <= 1 ? '1 mois' : `${months} mois`
}

/** Localised money field: symbol leads in en-NG, trails in fr-SN. */
function AmountField({
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  hint?: string
  error?: string
}) {
  const { locale } = useSettings()
  /* Never the literal "$". The symbol comes out of Intl for the account's own currency —
     « F CFA » here, « ₦ » in Lagos — and some locales put it before the digits. Three of
     these fields printed a dollar sign in an app whose balances are in francs. */
  const { symbol: sym } = splitMoney(0, { locale, currency: DEFAULT_CURRENCY })
  const symbol = (
    <span className={styles.symbol} aria-hidden="true">
      {sym}
    </span>
  )
  return (
    <Field
      label={label}
      value={value}
      onChange={(e) => onChange(sanitizeAmountInput(e.target.value))}
      onBlur={onBlur}
      inputMode="decimal"
      placeholder="0"
      leading={locale === 'en-NG' ? symbol : undefined}
      trailing={locale === 'fr-SN' ? symbol : undefined}
      hint={hint}
      error={error}
    />
  )
}

// ---------------------------------------------------------------- création

function NewGoal() {
  const navigate = useNavigate()
  const { locale } = useSettings()
  const { toast } = useToast()
  const goals = useGoals()
  const savings = useSavings()

  const [name, setName] = useState('')
  const [targetRaw, setTargetRaw] = useState('')
  const [monthlyRaw, setMonthlyRaw] = useState('')
  const [initialRaw, setInitialRaw] = useState('')
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [sheetOpen, setSheetOpen] = useState(false)

  const create = useMutation((input: { name: string; target: number; monthlyContribution: number; initialDeposit: number }) => api.savings.goals.create(input))
  const details = (create.error as ApiError | null)?.details

  const target = parseAmountInput(targetRaw)
  const monthly = parseAmountInput(monthlyRaw)
  const initial = parseAmountInput(initialRaw)
  const free = unallocated(savings.data?.balance, goals.data)

  const errors = {
    name: !name.trim() ? 'Donnez un nom à votre objectif.' : details?.name,
    target: target <= 0 ? 'Entrez un montant supérieur à 0.' : details?.target,
    /* Optional. A monthly amount is what makes the date estimable, not what makes the goal
       valid — « je mets de côté quand je peux » is how most people save, and refusing to
       create the goal without a plan is the app telling them they are doing it wrong. */
    monthly: monthly < 0 ? 'Entrez un versement mensuel valide.' : details?.monthlyContribution,
    initial: free !== undefined && initial > free + 1e-9 ? 'Le dépôt initial dépasse le solde non affecté.' : undefined,
  }
  const valid = !errors.name && !errors.target && !errors.monthly && !errors.initial
  /** An error is only shown once the field has been left (or the server rejected it). */
  const show = (key: FieldKey) => (touched[key] ? errors[key] : details?.[key === 'monthly' ? 'monthlyContribution' : key])
  const blur = (key: FieldKey) => () => setTouched((t) => (t[key] ? t : { ...t, [key]: true }))

  const months = valid ? monthsToTarget(target, initial, monthly) : null
  const estimated = months === null ? null : dateInMonths(months)

  const onSubmit = () => {
    setTouched({ name: true, target: true, monthly: true, initial: true })
    if (!valid) return
    setSheetOpen(true)
  }

  const onConfirm = async () => {
    try {
      await create.mutate({ name: name.trim(), target, monthlyContribution: monthly, initialDeposit: initial })
      setSheetOpen(false)
      toast('Objectif créé')
      navigate('/epargne')
    } catch {
      /* affiché dans la feuille */
    }
  }

  return (
    <div className={styles.page} data-cascade>
      <PageHeader close back="/epargne" title="Nouvel objectif" eyebrow="Épargne" className={styles.head} />

      <div className={styles.form}>
        <Field
          label="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={blur('name')}
          placeholder="Voyage, fonds d’urgence…"
          maxLength={40}
          error={show('name')}
        />
        <AmountField label="Montant cible" value={targetRaw} onChange={setTargetRaw} onBlur={blur('target')} error={show('target')} />
        <AmountField label="Versement mensuel" value={monthlyRaw} onChange={setMonthlyRaw} onBlur={blur('monthly')} error={show('monthly')} />
        <AmountField
          label="Dépôt initial"
          value={initialRaw}
          onChange={setInitialRaw}
          onBlur={blur('initial')}
          hint={free === undefined ? undefined : `Depuis le solde non affecté : ${formatMoney(free, { locale })}`}
          error={errors.initial}
        />
      </div>

      <section className={styles.summary} aria-live="polite">
        {target > 0 ? <ProgressBar value={goalProgress(initial, target)} label="Progression estimée" /> : null}
        {estimated && months !== null ? (
          <div className={styles.summaryRow}>
            <p className={styles.summaryMain}>{`Atteint vers ${formatMonthYear(estimated, locale)}`}</p>
            <p className={`t-small ${styles.summaryAside}`}>{monthsLabel(months)}</p>
          </div>
        ) : (
          <p className={`t-small ${styles.summaryHint}`}>Indiquez un montant cible et un versement mensuel pour estimer la date d’atteinte.</p>
        )}
      </section>

      <Button size="lg" block disabled={!valid} className={styles.cta} onClick={onSubmit}>
        Créer l’objectif
      </Button>

      <ConfirmSheet
        open={sheetOpen}
        onClose={() => {
          if (create.pending) return
          setSheetOpen(false)
        }}
        title="Confirmer l’objectif"
        hero={<Money value={target} unmasked />}
        heroCaption={name.trim()}
        lines={[
          { label: 'Versement mensuel', value: <Money value={monthly} unmasked /> },
          { label: 'Dépôt initial', value: <Money value={initial} unmasked /> },
          { label: 'Frais', value: <Money value={0} unmasked /> },
          { label: 'Date estimée', value: estimated ? formatMonthYear(estimated, locale) : '—' },
        ]}
        note="Le dépôt initial reste dans votre Épargne : il y est simplement réservé à cet objectif."
        confirmLabel="Créer l’objectif"
        onConfirm={() => void onConfirm()}
        pending={create.pending}
        error={create.error}
      />
    </div>
  )
}

// ------------------------------------------------------------------ détail

function GoalDetail({ goal, free }: { goal: SavingsGoal; free: number | undefined }) {
  const navigate = useNavigate()
  const { locale, hidden } = useSettings()
  const { toast, dismiss } = useToast()

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(goal.name)
  const [targetRaw, setTargetRaw] = useState(() => toKeypadRaw(goal.target))
  const [monthlyRaw, setMonthlyRaw] = useState(() => toKeypadRaw(goal.monthlyContribution))
  const [addRaw, setAddRaw] = useState('')

  const update = useMutation((patch: { name: string; target: number; monthlyContribution: number }) => api.savings.goals.update(goal.id, patch))
  const contribute = useMutation((amount: number) => api.savings.goals.contribute(goal.id, amount))
  const remove = useMutation(() => api.savings.goals.remove(goal.id))

  const pct = goalPercent(goal.current, goal.target)
  const remaining = Math.max(0, goal.target - goal.current)
  const months = monthsToTarget(goal.target, goal.current, goal.monthlyContribution)

  const editTarget = parseAmountInput(targetRaw)
  const editMonthly = parseAmountInput(monthlyRaw)
  const editValid = name.trim().length > 0 && editTarget > 0 && editMonthly > 0

  const added = parseAmountInput(addRaw)
  const addError = added > 0 && free !== undefined && added > free + 1e-9 ? 'Montant supérieur au solde non affecté.' : (contribute.error?.message ?? null)

  /** A toast is painted above the sheet layer, so it is cleared before one opens. */
  const openEdit = () => {
    setName(goal.name)
    setTargetRaw(toKeypadRaw(goal.target))
    setMonthlyRaw(toKeypadRaw(goal.monthlyContribution))
    update.reset()
    dismiss()
    setEditOpen(true)
  }

  const openAdd = () => {
    contribute.reset()
    dismiss()
    setAddOpen(true)
  }

  const openDelete = () => {
    remove.reset()
    dismiss()
    setDeleteOpen(true)
  }

  const onSave = async () => {
    try {
      await update.mutate({ name: name.trim(), target: editTarget, monthlyContribution: editMonthly })
      setEditOpen(false)
      toast('Objectif mis à jour')
    } catch {
      /* affiché dans la feuille */
    }
  }

  const onAdd = async () => {
    try {
      await contribute.mutate(added)
      setAddOpen(false)
      setAddRaw('')
      toast('Fonds ajoutés à l’objectif')
    } catch {
      /* affiché sous le montant */
    }
  }

  const onDelete = async () => {
    try {
      await remove.mutate()
      setDeleteOpen(false)
      toast('Objectif supprimé')
      navigate('/epargne')
    } catch {
      /* affiché dans la feuille */
    }
  }

  return (
    <div className={styles.page} data-cascade>
      <PageHeader
        back="/epargne"
        title={goal.name}
        eyebrow="Objectif"
        level="h2"
        className={styles.head}
        actions={
          <Button variant="ghost" icon={<Icon name="pencil" size={18} />} onClick={openEdit}>
            Modifier
          </Button>
        }
      />

      <section className={styles.hero}>
        <AmountDisplay value={goal.current} caption={`sur ${inlineMoney(goal.target, hidden, { locale })} · ${formatWholePercent(pct, locale)}`} />
        <ProgressBar value={goalProgress(goal.current, goal.target)} size="regular" label={`${goal.name} : ${pct} %`} className={styles.bar} />
      </section>

      <dl className={styles.stats}>
        <div className={styles.cell}>
          <dt className="t-name">Versement mensuel</dt>
          <dd className={styles.cellValue}>
            <Money value={goal.monthlyContribution} />
          </dd>
        </div>
        <div className={styles.cell}>
          <dt className="t-name">Date estimée</dt>
          <dd className={styles.cellValue}>{months === null ? '—' : formatMonthYear(goal.estimatedDate, locale)}</dd>
        </div>
        <div className={styles.cell}>
          <dt className="t-name">Restant</dt>
          <dd className={styles.cellValue}>
            <Money value={remaining} />
          </dd>
        </div>
      </dl>

      <p className={`t-small ${styles.note}`}>
        {months === null
          ? 'Ajoutez un versement mensuel pour estimer la date d’atteinte.'
          : months === 0
            ? `Objectif atteint. Créé le ${formatDate(goal.createdAt, { locale })}.`
            : `Encore ${monthsLabel(months)} au rythme actuel. Créé le ${formatDate(goal.createdAt, { locale })}.`}
      </p>

      <div className={styles.cta}>
        <Button size="lg" block onClick={openAdd}>
          Ajouter des fonds à l’objectif
        </Button>
      </div>

      <div className={styles.danger}>
        <Button variant="destructive" block onClick={openDelete}>
          Supprimer l’objectif
        </Button>
      </div>

      <Sheet
        open={editOpen}
        onClose={() => {
          if (update.pending) return
          setEditOpen(false)
        }}
        title="Modifier l’objectif"
        locked={update.pending}
        footer={
          <>
            <Button size="lg" block disabled={!editValid} loading={update.pending} onClick={() => void onSave()}>
              Enregistrer
            </Button>
            <Button variant="ghost" block disabled={update.pending} onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <AmountField label="Montant cible" value={targetRaw} onChange={setTargetRaw} />
          <AmountField label="Versement mensuel" value={monthlyRaw} onChange={setMonthlyRaw} />
          {update.error ? (
            <p className={styles.error} role="alert">
              {update.error.message}
            </p>
          ) : null}
        </div>
      </Sheet>

      <Sheet
        open={addOpen}
        onClose={() => {
          if (contribute.pending) return
          setAddOpen(false)
        }}
        title="Ajouter des fonds"
        locked={contribute.pending}
        footer={
          <>
            <Button size="lg" block disabled={!(added > 0) || !!addError} loading={contribute.pending} onClick={() => void onAdd()}>
              Ajouter
            </Button>
            <Button variant="ghost" block disabled={contribute.pending} onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
          </>
        }
      >
        <div className={styles.entry}>
          <AmountEntry
            label="Montant à affecter"
            value={addRaw}
            onChange={(v) => {
              setAddRaw(v)
              if (contribute.error) contribute.reset()
            }}
            secondary={free === undefined ? undefined : `Non affecté : ${formatMoney(free, { locale })}`}
            error={addError}
            onMax={free === undefined ? undefined : () => setAddRaw(toKeypadRaw(floorTo(Math.min(free, remaining))))}
            disabled={contribute.pending}
          />
        </div>
      </Sheet>

      <ConfirmSheet
        open={deleteOpen}
        onClose={() => {
          if (remove.pending) return
          setDeleteOpen(false)
        }}
        title="Supprimer l’objectif"
        lines={[
          { label: 'Objectif', value: goal.name },
          { label: 'Montant réservé', value: <Money value={goal.current} unmasked /> },
        ]}
        note="Les fonds restent dans votre Épargne."
        confirmLabel="Supprimer"
        onConfirm={() => void onDelete()}
        pending={remove.pending}
        error={remove.error}
        destructive
      />
    </div>
  )
}

// ------------------------------------------------------------------- route

export default function GoalPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goals = useGoals()
  const savings = useSavings()
  const goal = useMemo(() => goals.data?.find((g) => g.id === id), [goals.data, id])
  const free = unallocated(savings.data?.balance, goals.data)

  if (!id) return <NewGoal />

  if (goals.loading) {
    return (
      <div className={styles.page} data-cascade>
        <PageHeader back="/epargne" title="Objectif" level="h2" className={styles.head} hideTitle />
        <Skeleton width="60%" height="var(--fs-display)" />
        <Skeleton width="40%" height={16} className={styles.skeletonLine} />
      </div>
    )
  }

  if (goals.error && !goals.data) {
    return (
      <div className={styles.page} data-cascade>
        <PageHeader back="/epargne" title="Objectif" level="h2" className={styles.head} />
        <ErrorState error={goals.error} onRetry={() => void goals.refetch()} />
      </div>
    )
  }

  if (!goal) {
    return (
      <div className={styles.page} data-cascade>
        <PageHeader back="/epargne" title="Objectif introuvable" level="h2" className={styles.head} />
        <EmptyState
          message="Cet objectif n’existe plus ou a été supprimé."
          action={
            <Button variant="secondary" onClick={() => navigate('/epargne')}>
              Retour
            </Button>
          }
        />
      </div>
    )
  }

  return <GoalDetail key={goal.id} goal={goal} free={free} />
}

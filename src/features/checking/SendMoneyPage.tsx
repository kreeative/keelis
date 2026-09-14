/**
 * Envoyer de l’argent : e-Transfer, virement interne (vers l’Épargne) ou virement bancaire.
 * Montant → confirmation détaillée (frais et délai explicites) → succès.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import { handleField } from './handle'
import { ApiError, type MoneyMovementResult, type TransferProvider } from '@/api/types'
import { Button, Field, Icon, ListRow, Money, PageHeader, SegmentedControl } from '@/components'
import { AmountEntry, ConfirmSheet, SuccessScreen, useAccount, useAccountId, useTransaction } from '@/features/shared'
import { formatMoney, parseAmountInput } from '@/lib/format'
import { bicMatchesIban, checkIban, formatIban, isValidBic, normalizeIban, type IbanError } from '@/lib/iban'
import { QK, useQuery, useSettings } from '@/store'
import styles from './SendMoneyPage.module.css'

type Mode = 'operateur' | 'interne' | 'bancaire'

const MODES: ReadonlyArray<{ value: Mode; label: string; title: string; eta: string; description: string }> = [
  { value: 'operateur', label: 'Transfert', title: 'Transfert', eta: 'Quelques minutes', description: 'Vers Wave, Orange Money, MoneyGram, Interac et une douzaine d’autres.' },
  { value: 'interne', label: 'Interne', title: 'Virement interne', eta: 'Instantané', description: 'Instantané, entre vos comptes Keewal Meere.' },
  { value: 'bancaire', label: 'Bancaire', title: 'Virement bancaire', eta: '1 à 2 jours ouvrables', description: '1 à 2 jours ouvrables, vers une autre institution.' },
]


/**
 * The receipt, which follows the transaction rather than freezing on the word « attente ».
 *
 * It used to read « En attente · Instantané », which is a contradiction the person is left
 * holding: the sheet they just confirmed promised the transfer was immediate, and the
 * screen that follows says it has not happened. The backend settles it a second and a half
 * later, while they are still looking at this page, and the event is already on the wire —
 * the screen simply was not listening. `SavingsMovePage` and `TradePage` have always
 * listened; this flow and the crypto send were the two that did not, and four money flows
 * in one app cannot report completion two different ways.
 */
function SendSuccess({ result, method }: { result: { movement: MoneyMovementResult; recipient: string; amount: number }; method: string }) {
  const tx = useTransaction(result.movement.transactionId)
  const settled = tx.data?.status === 'posted'
  const failed = tx.data?.status === 'failed' || tx.data?.status === 'reversed'
  return (
    <SuccessScreen
      title="Envoi confirmé"
      hero={<Money value={result.amount} unmasked />}
      caption={`À ${result.recipient}`}
      /* While it is pending the delay is the useful half of the status — « quelques
         minutes » or « 1 à 2 jours ouvrables » is what somebody wants to know. Once it has
         settled the delay is history, and repeating it beside « Réglé » would read as a
         wait that is still to come. */
      status={failed ? 'Échouée' : settled ? 'Réglé' : `En attente · ${result.movement.eta}`}
      details={[
        { label: 'Méthode', value: method },
        { label: 'Frais', value: <Money value={result.movement.fee ?? 0} unmasked /> },
      ]}
      primaryLabel="Terminé"
      primaryTo="/carte"
      secondaryLabel="Voir la transaction"
      secondaryTo={`/transactions/${result.movement.transactionId}`}
    />
  )
}

/* Each IBAN failure gets its own sentence. "IBAN invalide" on a number someone has copied
   off a statement tells them nothing about where to look. */
const IBAN_MESSAGE: Readonly<Record<IbanError, string>> = {
  empty: 'Entrez l’IBAN du destinataire.',
  shape: 'Un IBAN commence par deux lettres de pays et deux chiffres, par exemple SN08…',
  country: 'Ce pays n’est pas encore pris en charge pour les virements.',
  length: 'Cet IBAN n’a pas la longueur attendue pour son pays.',
  checksum: 'La clé de contrôle ne correspond pas — vérifiez un chiffre.',
}

function isMode(v: string | null): v is Mode {
  return v === 'operateur' || v === 'interne' || v === 'bancaire'
}

/**
 * The keypad stores its raw value with a comma as decimal separator and counts the
 * decimals it already has by splitting on that comma. Anything seeded from outside
 * (« Max », the `montant` query param) has to be normalised first, otherwise the
 * decimal cap is bypassed and a later comma makes the value unparsable.
 */
function toKeypadValue(raw: string | number | undefined): string {
  if (raw === undefined || raw === '') return ''
  const n = typeof raw === 'number' ? raw : parseAmountInput(raw)
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

export default function SendMoneyPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { locale } = useSettings()
  const account = useAccount('checking')
  const savingsId = useAccountId('savings')
  const balance = account.data?.balance

  const modeParam = params.get('mode')
  const mode: Mode = isMode(modeParam) ? modeParam : 'operateur'
  const config = MODES.find((m) => m.value === mode)!
  const internal = mode === 'interne'
  const wire = mode === 'bancaire'
  /* The chosen rail comes back from /envoyer/operateurs as a query param, so the picker can
     be a page of its own without this form having to hold its state. */
  const providers = useQuery<TransferProvider[]>(QK.transferProviders, () => api.transfers.providers())
  const operator = providers.data?.find((p) => p.id === params.get('operateur')) ?? null
  const field = handleField(operator?.handle)

  /* Switching rails changes what the field *is*. Keeping « nom@exemple.sn » in a box now
     labelled « Numéro de téléphone » would hand the person an error they did not cause. */
  const lastHandle = useRef(operator?.handle)
  useEffect(() => {
    if (lastHandle.current === operator?.handle) return
    lastHandle.current = operator?.handle
    setContact('')
    setContactError(null)
  }, [operator?.handle])

  const [name, setName] = useState(params.get('name') ?? '')
  const [contact, setContact] = useState(params.get('to') ?? '')
  const [note, setNote] = useState('')
  // Bank coordinates, for the wire branch only.
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [ibanError, setIbanError] = useState<string | null>(null)
  const [bicError, setBicError] = useState<string | null>(null)
  const [amount, setAmount] = useState(() => toKeypadValue(params.get('montant') ?? ''))

  const [nameError, setNameError] = useState<string | null>(null)
  const [contactError, setContactError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [needsFunds, setNeedsFunds] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [sendError, setSendError] = useState<ApiError | null>(null)
  const [result, setResult] = useState<{ movement: MoneyMovementResult; recipient: string; amount: number } | null>(null)

  const value = useMemo(() => parseAmountInput(amount), [amount])
  /* The operator's fee — Wave takes 1 %, MoneyGram 2.5 % plus a fixed amount. It used to
     read « Frais 0 F CFA », under a note claiming none were charged: true of Keewal
     Meere's own share, and irrelevant to the person paying. */
  const operatorFee = operator && !internal && !wire ? Math.round(value * operator.feePct) + (operator.feeFixed ?? 0) : 0
  const debited = value + operatorFee
  const recipientLabel = internal ? 'Compte Épargne' : name.trim() || (wire ? formatIban(iban) : contact.trim())

  const setMode = (next: Mode) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('mode', next)
        return p
      },
      { replace: true },
    )
    setNameError(null)
    setContactError(null)
    setSendError(null)
  }

  const validate = (): boolean => {
    let ok = true
    setNeedsFunds(false)
    if (!internal) {
      if (!name.trim()) {
        setNameError(wire ? 'Entrez le nom du titulaire du compte.' : 'Entrez le nom du destinataire.')
        ok = false
      } else setNameError(null)
    }
    if (wire) {
      /* An IBAN carries its own checksum, so a transposed digit is catchable here rather
         than after the money has left. Each failure says which one it is: "invalid" on a
         field someone has typed carefully is the least useful error a form can give. */
      const problem = checkIban(iban)
      setIbanError(problem ? IBAN_MESSAGE[problem] : null)
      if (problem) ok = false
      const b = bic.trim()
      if (!b) {
        setBicError('Entrez le BIC / SWIFT de la banque.')
        ok = false
      } else if (!isValidBic(b)) {
        setBicError('Un BIC compte 8 ou 11 caractères, par exemple CBAOSNDA.')
        ok = false
      } else if (!problem && !bicMatchesIban(b, iban)) {
        setBicError('Ce BIC désigne un autre pays que l’IBAN.')
        ok = false
      } else setBicError(null)
    } else if (!internal) {
      if (!field.test(contact)) {
        setContactError(field.error)
        ok = false
      } else setContactError(null)
    }
    if (!(value > 0)) {
      setAmountError('Entrez un montant.')
      ok = false
    } else if (balance !== undefined && debited > balance) {
      setAmountError('Solde insuffisant sur le compte Chèque.')
      setNeedsFunds(true)
      ok = false
    } else setAmountError(null)
    return ok
  }

  const submit = async () => {
    // Both ends of the movement come from the accounts list. Without the source account
    // there is nothing to debit, and the screen's own balance line has not rendered yet.
    if (!account.data) return
    setPending(true)
    setSendError(null)
    try {
      const movement = await api.transfers.send({
        fromAccountId: account.data.id,
        toAccountId: internal ? savingsId : undefined,
        recipient: internal ? undefined : { name: name.trim(), handle: wire ? undefined : contact.trim(), iban: wire ? normalizeIban(iban) : undefined, bic: wire ? bic.trim().toUpperCase() : undefined },
        amount: value,
        note: note.trim() || undefined,
        method: internal ? 'internal' : mode === 'bancaire' ? 'wire' : 'operator',
        providerId: internal || wire ? undefined : operator?.id,
      })
      setConfirmOpen(false)
      setResult({ movement, recipient: recipientLabel, amount: value })
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError('L’envoi n’a pas pu être effectué.', 'unknown')
      if (apiErr.details?.handle) {
        setConfirmOpen(false)
        setContactError(apiErr.details.handle)
      } else if (apiErr.code === 'insufficient_funds') {
        setConfirmOpen(false)
        setAmountError(apiErr.message)
        setNeedsFunds(true)
      } else {
        setSendError(apiErr)
      }
    } finally {
      setPending(false)
    }
  }

  if (result) {
    return (
      <div className={styles.page}>
        <SendSuccess result={result} method={config.title} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader close back="/carte" title="Envoyer" />

      <section className={styles.block} aria-labelledby="send-method">
        <h2 id="send-method" className="t-section">
          Méthode
        </h2>
        <SegmentedControl segments={MODES.map((m) => ({ value: m.value, label: m.label }))} value={mode} onChange={setMode} label="Méthode d’envoi" block />
        <p className={styles.description}>{config.description}</p>
      </section>

      <section className={styles.block} aria-labelledby="send-recipient">
        <h2 id="send-recipient" className="sr-only">
          Destinataire
        </h2>
        {internal ? (
          <ListRow
            static
            leading={
              <span className={styles.icon} aria-hidden="true">
                <Icon name="piggy-bank" size={20} />
              </span>
            }
            title="Vers Épargne"
            subtitle="Votre compte d’épargne Keewal Meere"
          />
        ) : (
          <div className={styles.fields}>
            <Field
              label={wire ? 'Titulaire du compte' : 'Nom du destinataire'}
              autoComplete="name"
              value={name}
              error={nameError ?? undefined}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
              }}
            />
            {!wire ? (
              /* One row, not fifteen: the operator list is long enough to be its own page,
                 and it does not belong inside a form someone is already filling in. */
              <ListRow
                to="/envoyer/operateurs"
                leading={
                  <span className={styles.icon} aria-hidden="true">
                    <Icon name={operator ? 'transfer' : 'search'} size={20} />
                  </span>
                }
                title={operator ? operator.name : 'Choisir un opérateur'}
                subtitle={operator ? `${operator.reach} · ${operator.eta}` : 'Wave, Orange Money, MoneyGram, Interac…'}
                chevron
              />
            ) : null}
            {wire ? (
              <>
                <Field
                  label="IBAN"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="SN08 SN01 0015 2000 0485 0000 3035"
                  hint="Le numéro de compte international, tel qu’il figure sur le relevé."
                  value={iban}
                  error={ibanError ?? undefined}
                  /* Grouped in fours as it is typed, the way a bank prints it — a 28-character
                     run of digits is unreadable and impossible to check against a statement. */
                  onChange={(e) => {
                    setIban(formatIban(e.target.value))
                    setIbanError(null)
                  }}
                />
                <Field
                  label="BIC / SWIFT"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="CBAOSNDA"
                  hint="8 ou 11 caractères, identifiant la banque du destinataire."
                  value={bic}
                  error={bicError ?? undefined}
                  onChange={(e) => {
                    setBic(e.target.value.toUpperCase())
                    setBicError(null)
                  }}
                />
              </>
            ) : (
              /* Label, keyboard, autocomplete, placeholder and check all come from the
                 operator's own handle — see `handle.ts`. */
              <Field
                label={field.label}
                type={field.type}
                inputMode={field.inputMode}
                autoComplete={field.autoComplete}
                spellCheck={false}
                placeholder={field.placeholder}
                hint={field.hint}
                value={contact}
                error={contactError ?? undefined}
                onChange={(e) => {
                  setContact(e.target.value)
                  setContactError(null)
                }}
              />
            )}
            <Field label={wire ? 'Motif du virement' : 'Message'} hint="Facultatif" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
      </section>

      <section className={styles.amount} aria-labelledby="send-amount">
        <h2 id="send-amount" className="sr-only">
          Montant
        </h2>
        <AmountEntry
          label="Montant à envoyer"
          value={amount}
          onChange={(v) => {
            setAmount(v)
            setAmountError(null)
            setNeedsFunds(false)
          }}
          calculator
          presets={[5_000, 10_000, 25_000, 50_000]}
          onMax={balance !== undefined ? () => setAmount(toKeypadValue(balance)) : undefined}
          secondary={balance !== undefined ? `Disponible : ${formatMoney(balance, { locale })}` : undefined}
          error={amountError}
        />
        {needsFunds ? (
          <Button variant="ghost" onClick={() => navigate('/fonds')} icon={<Icon name="plus" size={18} />} className={styles.addFunds}>
            Ajouter des fonds
          </Button>
        ) : null}
      </section>

      <div className={styles.footer}>
        <Button
          size="lg"
          block
          onClick={() => {
            if (validate()) setConfirmOpen(true)
          }}
        >
          Continuer
        </Button>
      </div>

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmer l’envoi"
        hero={<Money value={value} unmasked />}
        heroCaption={`À ${recipientLabel}`}
        lines={[
          /* The destination is already the caption under the amount. This row repeats it
             only when it can add the thing that actually identifies the account — the IBAN
             on a wire, the handle on an operator transfer. On an internal transfer there is
             nothing to add, and « À Compte Épargne » directly above « Vers · Compte
             Épargne » reads as two different facts until you notice they are one.

             On a wire the line under the name is the IBAN, not the operator handle: it is
             the one thing worth re-reading before the money leaves, and it is what the
             recipient's bank acts on if the name and the account disagree. */
          ...(internal ? [] : [{ label: 'Destinataire', value: recipientLabel, hint: wire ? formatIban(iban) : contact.trim() }]),
          ...(wire ? [{ label: 'BIC / SWIFT', value: bic.trim().toUpperCase() }] : []),
          { label: 'Méthode', value: config.title },
          { label: 'Montant', value: <Money value={value} unmasked /> },
          { label: operator ? `Frais ${operator.name}` : 'Frais', value: <Money value={operatorFee} unmasked /> },
          { label: 'Total débité', value: <Money value={debited} unmasked />, strong: true },
          { label: 'Délai', value: config.eta },
        ]}
        note={
          sendError && (sendError.code === 'offline' || sendError.code === 'network')
            ? 'Rien n’a été débité. Vos informations restent saisies : réessayez une fois la connexion rétablie.'
            : internal
              ? 'Le virement interne est immédiat et sans frais.'
              : operatorFee > 0 && operator
                ? `Les frais sont ceux de ${operator.name}. Keewal Meere n’en ajoute aucun.`
                : 'Aucuns frais ne sont prélevés pour cet envoi.'
        }
        confirmLabel="Envoyer"
        onConfirm={() => void submit()}
        pending={pending}
        error={sendError}
      />
    </div>
  )
}

/**
 * Détail d’une transaction : montant héros, statut, puis les faits et les recours
 * (signalement, duplication d’un envoi, reçu).
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, CATEGORY_LABELS, TYPE_LABELS } from '@/api'
import type { Transaction, TransactionStatus } from '@/api/types'
import type { BadgeTone } from '@/components'
import { AmountDisplay, Avatar, Badge, Button, EmptyState, ErrorState, Icon, List, ListRow, PageHeader, SelectField, Sheet, Skeleton, TextAreaField } from '@/components'
import { transactionIcon, useTransaction } from '@/features/shared'
import { formatCrypto, formatDateTime, formatMoney } from '@/lib/format'
import { useSettings, useToast } from '@/store'
import { cn } from '@/lib/cn'
import styles from './TransactionDetailPage.module.css'

const STATUS: Record<TransactionStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'En attente', tone: 'neutral' },
  posted: { label: 'Réglée', tone: 'accent' },
  failed: { label: 'Échouée', tone: 'neg' },
  reversed: { label: 'Annulée', tone: 'neg' },
}

const CHANNELS: Record<NonNullable<Transaction['channel']>, string> = {
  card_present: 'En magasin',
  online: 'En ligne',
  app: 'Application',
  bank: 'Banque',
}

const REPORT_REASONS = [
  'Je ne reconnais pas cette transaction',
  'Le montant est incorrect',
  'Le service ou le produit n’a pas été reçu',
  'Débit en double',
  'Autre',
]

const OUTGOING_TRANSFERS: Transaction['type'][] = ['etransfer_out', 'transfer_out']

/**
 * « Dupliquer » only makes sense for money the user sent to someone. Transfers the app
 * books between its own products (Vers Épargne, Vers Crypto) or preauthorised debits
 * (loyer, électricité) share the same type, so the category decides.
 */
function canDuplicate(tx: Transaction): boolean {
  return OUTGOING_TRANSFERS.includes(tx.type) && tx.category === 'transfer'
}

/** Hero leading glyph size (48px = --sp-7). */
const HERO_LEADING = 48

export default function TransactionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { locale, hidden } = useSettings()
  const { toast } = useToast()
  const query = useTransaction(id)
  const tx = query.data

  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState(REPORT_REASONS[0] ?? '')
  const [note, setNote] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [receiptPending, setReceiptPending] = useState(false)

  const notFound = query.error?.code === 'not_found'

  if (notFound || (!tx && query.error && !query.refetching)) {
    return (
      <div className={styles.page}>
        <PageHeader back={-1} title="Transaction" />
        {notFound ? (
          <EmptyState
            compact
            message="Cette transaction est introuvable."
            action={
              <Button variant="secondary" onClick={() => navigate('/carte')}>
                Retour
              </Button>
            }
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    )
  }

  if (!tx) {
    return (
      <div className={styles.page}>
        <PageHeader back={-1} title="Transaction" hideTitle />
        <div className={styles.hero} aria-busy="true">
          <Skeleton shape="circle" width={48} height={48} />
          <Skeleton width="55%" height={22} />
          <Skeleton width="45%" height="var(--fs-h1)" />
          <Skeleton width="35%" height={14} />
        </div>
        <div className={styles.section}>
          <Skeleton height={48} />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      </div>
    )
  }

  const status = STATUS[tx.status]
  const incoming = tx.amount > 0
  const duplicable = canDuplicate(tx)

  const submitReport = async () => {
    setReporting(true)
    setReportError(null)
    try {
      const { caseId } = await api.transactions.report(tx.id, note.trim() ? `${reason} — ${note.trim()}` : reason)
      setReportOpen(false)
      setNote('')
      toast(`Dossier ${caseId} ouvert`)
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Le signalement n’a pas pu être envoyé.')
    } finally {
      setReporting(false)
    }
  }

  const requestReceipt = async () => {
    setReceiptPending(true)
    try {
      const { sentTo } = await api.transactions.requestReceipt(tx.id)
      toast(`Reçu envoyé à ${sentTo}`)
    } catch {
      toast('Le reçu n’a pas pu être envoyé', 'error')
    } finally {
      setReceiptPending(false)
    }
  }

  const duplicate = () => {
    const params = new URLSearchParams()
    params.set('mode', tx.type === 'transfer_out' ? 'bancaire' : 'etransfer')
    params.set('name', tx.counterparty)
    params.set('montant', String(Math.abs(tx.amount)))
    navigate(`/envoyer?${params.toString()}`)
  }

  const details: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: 'Catégorie', value: CATEGORY_LABELS[tx.category] },
    { label: 'Type', value: TYPE_LABELS[tx.type] },
    { label: 'Date', value: formatDateTime(tx.date, { locale }) },
    { label: 'Statut', value: status.label },
  ]
  if (tx.postedAt) details.push({ label: 'Réglée le', value: formatDateTime(tx.postedAt, { locale }) })
  if (tx.cardLast4) details.push({ label: 'Carte utilisée', value: `···· ${tx.cardLast4}` })
  if (tx.channel) details.push({ label: 'Canal', value: CHANNELS[tx.channel] })
  if (tx.asset) {
    details.push({ label: 'Actif', value: tx.asset.symbol })
    details.push({ label: 'Quantité', value: formatCrypto(tx.asset.quantity, tx.asset.symbol, { locale }) })
    details.push({ label: 'Prix', value: formatMoney(tx.asset.price, { locale }) })
  }
  if (tx.reference) details.push({ label: 'Référence', value: tx.reference, mono: true })
  if (tx.note) details.push({ label: 'Note', value: tx.note })

  return (
    <div className={styles.page}>
      <PageHeader back={-1} />

      <section className={styles.hero} aria-label="Résumé de la transaction">
        {tx.type === 'card' || tx.type === 'refund' ? (
          <Avatar label={tx.counterparty} size={HERO_LEADING} className={styles.leading} />
        ) : (
          <span className={cn(styles.leading, styles.circle, transactionIcon(tx).tone === 'accent' && styles.circleAccent)} aria-hidden="true">
            <Icon name={transactionIcon(tx).name} />
          </span>
        )}
        <h1 className="t-h2">{tx.counterparty}</h1>
        <AmountDisplay value={tx.amount} size="h1" className={cn(styles.amount, incoming && styles.incoming, incoming && !hidden && styles.plus)} />
        <div className={styles.meta}>
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className={styles.date}>{formatDateTime(tx.date, { locale })}</span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="tx-details">
        <h2 id="tx-details" className="t-label">
          Détails
        </h2>
        <dl className={styles.rows}>
          {details.map((d) => (
            <div key={d.label} className={styles.row}>
              <dt className={styles.rowLabel}>{d.label}</dt>
              <dd className={cn(styles.rowValue, d.mono && styles.mono)}>{d.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="tx-actions">
        <h2 id="tx-actions" className="t-label">
          Actions
        </h2>
        <List>
          <ListRow
            title="Signaler un problème"
            subtitle="Réponse sous 2 jours ouvrables"
            leading={
              <span className={styles.actionIcon} aria-hidden="true">
                <Icon name="flag" size={20} />
              </span>
            }
            chevron
            onClick={() => setReportOpen(true)}
          />
          {duplicable ? (
            <ListRow
              title="Dupliquer"
              subtitle="Renvoyer le même montant"
              leading={
                <span className={styles.actionIcon} aria-hidden="true">
                  <Icon name="recurring" size={20} />
                </span>
              }
              chevron
              onClick={duplicate}
            />
          ) : null}
          <ListRow
            title="Recevoir un reçu"
            subtitle={receiptPending ? 'Envoi en cours…' : 'Par courriel'}
            leading={
              <span className={styles.actionIcon} aria-hidden="true">
                <Icon name="receipt" size={20} />
              </span>
            }
            chevron
            disabled={receiptPending}
            onClick={() => void requestReceipt()}
          />
        </List>
      </section>

      <Sheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Signaler un problème"
        locked={reporting}
        footer={
          <>
            <Button size="lg" block onClick={() => void submitReport()} loading={reporting}>
              Envoyer le signalement
            </Button>
            <Button variant="ghost" block onClick={() => setReportOpen(false)} disabled={reporting}>
              Annuler
            </Button>
          </>
        }
      >
        <p className={styles.sheetIntro}>
          {tx.counterparty} · {formatMoney(tx.amount, { locale })}
        </p>
        <div className={styles.sheetFields}>
          <SelectField label="Motif" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectField>
          <TextAreaField label="Détails" hint="Facultatif" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </div>
        {reportError ? (
          <p className={styles.sheetError} role="alert">
            {reportError}
          </p>
        ) : null}
      </Sheet>
    </div>
  )
}

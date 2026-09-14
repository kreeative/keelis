/**
 * Statut d’un dépôt. La transaction est suivie en direct : elle apparaît « En attente »
 * dès la confirmation, puis passe à « Terminé » sans rechargement (les évènements de
 * l’API patchent le cache).
 */
import { useNavigate, useParams } from 'react-router-dom'
import type { Account, AccountKind, Transaction } from '@/api/types'
import type { IconName } from '@/components'
import { AmountDisplay, Badge, Button, EmptyState, ErrorState, Icon, PageHeader, Skeleton } from '@/components'
import { useAccounts, useTransaction } from '@/features/shared'
import { formatDateTime } from '@/lib/format'
import { useSettings } from '@/store'
import { cn } from '@/lib/cn'
import styles from './FundsStatusPage.module.css'

const TIMELINE_STEPS = 3

/** The account's own name, from the list. Ids are the back-end's; names are the user's. */
const KIND_NAME: Record<AccountKind, string> = { checking: 'Chèque', savings: 'Épargne', investing: 'Actifs', crypto: 'Crypto' }

function accountName(accounts: Account[] | undefined, accountId: string): string {
  const account = accounts?.find((a) => a.id === accountId)
  return account ? (account.name || KIND_NAME[account.kind]) : 'Chèque'
}

function statusBadge(tx: Transaction): { label: string; tone: 'accent' | 'neutral' | 'neg'; icon: IconName } {
  switch (tx.status) {
    case 'posted':
      return { label: 'Terminé', tone: 'accent', icon: 'checkmark-filled' }
    case 'failed':
      return { label: 'Échoué', tone: 'neg', icon: 'circle-alert' }
    case 'reversed':
      return { label: 'Annulé', tone: 'neg', icon: 'circle-alert' }
    default:
      return { label: 'En attente', tone: 'neutral', icon: 'clock' }
  }
}

export default function FundsStatusPage() {
  const { txId } = useParams()
  const navigate = useNavigate()
  const { locale } = useSettings()
  const tx = useTransaction(txId)

  const data = tx.data
  const notFound = tx.error?.code === 'not_found'

  return (
    <div className={styles.page}>
      {/* The hero amount is the dominant element; without it the title takes over. */}
      <PageHeader close back="/" title="Statut du dépôt" hideTitle={!!data} />

      {tx.loading ? (
        <div className={styles.body} aria-busy="true">
          <div className={styles.hero}>
            <Skeleton width="70%" height="var(--fs-display)" />
            <Skeleton width="40%" height={14} />
          </div>
          <div className={styles.timeline}>
            {Array.from({ length: TIMELINE_STEPS }).map((_, i) => (
              <div key={i} className={styles.skeletonStep}>
                <Skeleton shape="circle" width={12} height={12} />
                <Skeleton width="55%" height={14} />
              </div>
            ))}
          </div>
        </div>
      ) : tx.error && !notFound && !data ? (
        <ErrorState error={tx.error} onRetry={() => void tx.refetch()} />
      ) : data ? (
        <Status tx={data} locale={locale} />
      ) : (
        <EmptyState
          compact
          message="Cette transaction est introuvable."
          action={
            <Button variant="secondary" onClick={() => navigate('/')}>
              Retour à l’accueil
            </Button>
          }
        />
      )}
    </div>
  )
}

function Status({ tx, locale }: { tx: Transaction; locale: 'fr-SN' | 'en-NG' }) {
  const navigate = useNavigate()
  const incoming = tx.amount >= 0
  const accounts = useAccounts()
  const account = accountName(accounts.data, tx.accountId)
  const badge = statusBadge(tx)
  const posted = tx.status === 'posted'

  const steps = [
    { title: 'Demande reçue', meta: formatDateTime(tx.date, { locale }), done: true },
    { title: 'En traitement', meta: posted ? 'Traitement terminé' : (tx.note ?? 'Quelques minutes'), done: true },
    {
      title: incoming ? 'Fonds disponibles' : 'Transaction réglée',
      meta: posted && tx.postedAt ? formatDateTime(tx.postedAt, { locale }) : 'Dès la fin du traitement',
      done: posted,
    },
  ]

  return (
    <div className={styles.body}>
      <div className={styles.hero}>
        <AmountDisplay value={Math.abs(tx.amount)} caption={`${incoming ? 'Vers' : 'Depuis'} ${account}`} align="center" unmasked />
      </div>

      <div className={styles.live} aria-live="polite">
        <div className={styles.badge}>
          <Badge tone={badge.tone} icon={<Icon name={badge.icon} />}>{badge.label}</Badge>
        </div>

        <ol className={styles.timeline}>
          {steps.map((step, i) => (
            <li key={step.title} className={cn(styles.step, i === steps.length - 1 && styles.stepLast)}>
              <span className={styles.marker} aria-hidden="true">
                <span className={cn(styles.dot, step.done && styles.dotOn)} />
              </span>
              <span className={styles.stepText}>
                <span className={cn(styles.stepTitle, !step.done && styles.stepPending)}>{step.title}</span>
                <span className={styles.stepMeta}>{step.meta}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.actions}>
        <Button size="lg" block onClick={() => navigate('/')}>
          Retour à l’accueil
        </Button>
        <Button variant="ghost" block onClick={() => navigate('/fonds')}>
          Ajouter d’autres fonds
        </Button>
      </div>
    </div>
  )
}

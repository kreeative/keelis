/**
 * Coordonnées bancaires du compte Chèque ou Épargne, copiables une par une ou en bloc.
 */
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import type { AccountDetails, AccountKind } from '@/api/types'
import { Button, ErrorState, Icon, PageHeader, SegmentedControl, Skeleton } from '@/components'
import { useAccounts } from '@/features/shared'
import { QK, useQuery, useToast } from '@/store'
import { cn } from '@/lib/cn'
import styles from './AccountDetailsPage.module.css'

type AccountParam = 'cheque' | 'epargne'

/* Which account, said by kind. The id comes from the accounts list — it is the back-end's
   to choose, and a screen that hard-codes one shows an empty page against a real one. */
const ACCOUNTS: ReadonlyArray<{ value: AccountParam; label: string; kind: AccountKind; name: string }> = [
  { value: 'cheque', label: 'Chèque', kind: 'checking', name: 'Compte Chèque' },
  { value: 'epargne', label: 'Épargne', kind: 'savings', name: 'Compte Épargne' },
]

const PARAM = 'compte'

interface DetailRow {
  label: string
  value: string
  /** Used in the copy confirmation and the aria-label of the copy button */
  short: string
  /** Numbers are set in the mono face; names are not. */
  mono?: boolean
}

const SKELETON_ROWS = 6

function rowsOf(d: AccountDetails): DetailRow[] {
  return [
    { label: 'Titulaire', value: d.holderName, short: 'le nom du titulaire', mono: false },
    { label: 'Code banque', value: d.bankCode, short: 'le code banque', mono: true },
    { label: 'Code guichet', value: d.branchCode, short: 'le code guichet', mono: true },
    { label: 'Numéro de compte', value: d.accountNumber, short: 'le numéro de compte', mono: true },
    { label: 'Clé RIB', value: d.ribKey, short: 'la clé RIB', mono: true },
    { label: 'IBAN', value: d.iban, short: 'l’IBAN', mono: true },
    { label: 'SWIFT/BIC', value: d.swift, short: 'le code SWIFT', mono: true },
  ]
}

export default function AccountDetailsPage() {
  const [params, setParams] = useSearchParams()
  const { toast } = useToast()
  const current = ACCOUNTS.find((a) => a.value === params.get(PARAM)) ?? ACCOUNTS[0]!
  const accounts = useAccounts()
  const id = accounts.data?.find((a) => a.kind === current.kind)?.id
  const details = useQuery<AccountDetails>(id ? QK.accountDetails(id) : null, () => api.accounts.details(id!), { staleTime: 60_000 })

  const select = (value: AccountParam) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(PARAM, value)
        return next
      },
      { replace: true },
    )
  }

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast(`Copié : ${what}`)
    } catch {
      toast('Impossible de copier', 'error')
    }
  }

  const rows = details.data ? rowsOf(details.data) : []

  const copyAll = () => {
    if (!details.data) return
    const text = [current.name, ...rows.map((r) => `${r.label} : ${r.value}`)].join('\n')
    void copy(text, 'toutes les coordonnées')
  }

  return (
    <div className={styles.page} data-cascade>
      <PageHeader back="/carte" title="Détails du compte" eyebrow={current.name} />

      <SegmentedControl
        segments={ACCOUNTS.map((a) => ({ value: a.value, label: a.label }))}
        value={current.value}
        onChange={select}
        label="Compte"
        block
        className={styles.tabs}
      />

      {details.error && !details.data ? (
        <ErrorState error={details.error} onRetry={() => void details.refetch()} className={styles.state} />
      ) : (
        <>
          <dl className={styles.rows} aria-busy={!details.data || undefined}>
            {details.data
              ? rows.map((row) => (
                  <div key={row.label} className={styles.row}>
                    <dt className={styles.label}>{row.label}</dt>
                    <dd className={styles.value}>
                      <span className={cn(styles.text, row.mono && styles.mono)}>{row.value}</span>
                      <Button variant="ghost" iconOnly aria-label={`Copier ${row.short}`} onClick={() => void copy(row.value, row.short)} className={styles.copy}>
                        <Icon name="copy" size={18} />
                      </Button>
                    </dd>
                  </div>
                ))
              : Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <div key={i} className={styles.row}>
                    <Skeleton width="40%" height={12} />
                    <Skeleton width="60%" height={16} />
                  </div>
                ))}
          </dl>

          <div className={styles.footer}>
            <Button variant="ghost" onClick={copyAll} disabled={!details.data} icon={<Icon name="copy" size={18} />} className={styles.copyAll}>
              Tout copier
            </Button>
            <p className={styles.note}>
              Ces coordonnées servent à recevoir un dépôt direct ou un virement depuis une autre institution. Les fonds arrivent généralement en 1 à 2 jours ouvrables.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

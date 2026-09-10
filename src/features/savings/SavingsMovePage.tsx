import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'

export default function SavingsMovePage({ direction }: { direction: 'deposit' | 'withdraw' }) {
  return (
    <div className="page">
      <PageHeader title={direction === 'deposit' ? 'Déposer' : 'Retirer'} back={-1} />
      <EmptyState message="Cet écran est en construction." compact />
    </div>
  )
}

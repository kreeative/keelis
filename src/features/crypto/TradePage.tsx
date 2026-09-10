import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'

export default function TradePage({ side }: { side: 'buy' | 'sell' }) {
  return (
    <div className="page">
      <PageHeader title={side === 'buy' ? 'Acheter' : 'Vendre'} back={-1} />
      <EmptyState message="Cet écran est en construction." compact />
    </div>
  )
}

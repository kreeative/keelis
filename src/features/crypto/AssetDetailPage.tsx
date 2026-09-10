import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'

export default function Page() {
  return (
    <div className="page">
      <PageHeader title="Actif" back={-1} />
      <EmptyState message="Cet écran est en construction." compact />
    </div>
  )
}

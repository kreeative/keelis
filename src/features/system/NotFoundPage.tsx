import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <h1 className="t-h1">Page introuvable</h1>
      <EmptyState message="Cette adresse ne mène nulle part." action={<Button onClick={() => navigate('/')}>Retour à l’accueil</Button>} compact />
    </div>
  )
}

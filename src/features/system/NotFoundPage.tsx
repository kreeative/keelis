/**
 * 404 — un titre dominant, une phrase, deux sorties.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Icon } from '@/components'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className="t-label">Erreur 404</p>
        <h1 className="t-h1">Cette page n’existe pas</h1>
        <p className={styles.body}>L’adresse demandée ne mène nulle part. Elle a peut-être changé, ou le lien est incomplet.</p>
        <p className={styles.path}>{pathname}</p>
        <div className={styles.actions}>
          <Button size="lg" icon={<Icon name="house" size={18} />} onClick={() => navigate('/')}>
            Retour à l’accueil
          </Button>
          <Link to="/profil/aide" className={styles.help}>
            Consulter l’aide
          </Link>
        </div>
      </div>
    </div>
  )
}

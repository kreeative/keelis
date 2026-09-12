import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { Button, Icon, Wordmark } from '@/components'
import { useSession, useSettings, useToast } from '@/store'
import { SAVINGS_APY } from '@/api/mock/seed'
import { formatPercent } from '@/lib/format'
import { DEMO_CODE, DEMO_EMAIL } from './demo'
import styles from './WelcomePage.module.css'

export default function WelcomePage() {
  const navigate = useNavigate()
  const { setSession } = useSession()
  const { resolved, setTheme, locale } = useSettings()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const exploreDemo = async () => {
    setBusy(true)
    try {
      await api.auth.requestCode(DEMO_EMAIL)
      const r = await api.auth.verifyCode(DEMO_EMAIL, DEMO_CODE)
      if (r.session) {
        setSession(r.session)
        navigate('/')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Impossible d’ouvrir la démo.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.root}>
      <header className={styles.top}>
        <Button variant="ghost" iconOnly aria-label="Basculer le thème" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}>
          <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
        </Button>
      </header>
      <main className={styles.main}>
        <Wordmark size="lg" className="mark-clear" />
        <h1 className={`t-h1 ${styles.title}`}>Vos francs, votre épargne et vos placements. Au même endroit.</h1>
        <p className={`t-body t-muted ${styles.lede}`}>
          Compte chèque avec carte, épargne à {formatPercent(SAVINGS_APY, { locale, signed: false, minFraction: 2 })}, actions africaines et crypto,
          et le change avec sa marge affichée.
        </p>
      </main>
      <div className={styles.actions}>
        <Button size="lg" block onClick={() => navigate('/inscription/courriel')}>
          Créer un compte
        </Button>
        <Button size="lg" block variant="secondary" onClick={() => navigate('/inscription/courriel?mode=connexion')}>
          Se connecter
        </Button>
        <Button block variant="ghost" onClick={exploreDemo} loading={busy}>
          Explorer la démo
        </Button>
      </div>
      <p className={`t-label ${styles.footer}`}>
        <Link to="/entreprise">À propos de Keewal Meere</Link>
      </p>
      <div className={styles.toasts}>
      </div>
    </div>
  )
}

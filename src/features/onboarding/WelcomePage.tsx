/**
 * The front door, built on the anatomy the owner pointed at: a row of spaced micro-labels
 * across the top, the mark and the sentence under it, a photograph, and a rounded sheet
 * riding up over the frame carrying the actions.
 *
 * **It holds its shape with no photograph at all**, and that is the constraint that decided
 * the structure. The licensed images are the owner's to supply; until they land, the hero is
 * simply absent and the sheet rises to meet the type — which is a quieter version of the same
 * screen, not a broken one. Building the image-led layout while leaving the type-only layout
 * intact is the only way the app is shippable both before and after the photographs arrive.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, isLive } from '@/api'
import { Button, Icon, Photo, Wordmark, hasPhoto } from '@/components'
import { useSession, useSettings, useToast } from '@/store'
import { DEMO_CODE, DEMO_EMAIL } from './demo'
import styles from './WelcomePage.module.css'

export default function WelcomePage() {
  const navigate = useNavigate()
  const { setSession } = useSession()
  const { resolved, setTheme } = useSettings()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const illustrated = hasPhoto('welcome')

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
    <div className={`${styles.root} ${illustrated ? styles.illustrated : ''}`}>
      {/* The spaced micro-label row. `.t-label` is already 12px uppercase tracked +0.135em —
          the app's true micro-annotation role — so this is the existing type scale used for
          the job it was defined for, not a new one. The name is a label rather than the
          wordmark because the mark itself is directly below it, and a brand said twice in
          forty pixels is a brand said once too often. */}
      <header className={styles.top}>
        <span className={`t-label ${styles.topName}`}>Keewal Meere</span>
        <span className={`t-label ${styles.topHere}`}>Bienvenue</span>
        <Button
          variant="ghost"
          iconOnly
          className={styles.toggle}
          aria-label="Basculer le thème"
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
        >
          <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
        </Button>
      </header>

      <div className={styles.intro}>
        <Wordmark glyphOnly size="lg" className={styles.glyph} />
        <h1 className={`t-h1 ${styles.title}`}>Vos francs, votre épargne et vos placements. Au même endroit.</h1>
        <p className={`t-body t-muted ${styles.lede}`}>
          Compte chèque avec carte, épargne rémunérée, actions africaines et crypto, et le change
          avec sa marge affichée avant que vous confirmiez.
        </p>
      </div>

      {/* `sizes` is the screen's real measure, not `100vw`: the column caps at 520px, so a
          phone that fetched for the viewport would pull the 1600 for nothing. */}
      <Photo name="welcome" className={styles.hero} sizes="(min-width: 520px) 520px, 100vw" scrim="bottom" priority />

      <div className={styles.sheet}>
        <div className={styles.actions}>
          <Button size="lg" block onClick={() => navigate('/inscription/courriel')}>
            Créer un compte
          </Button>
          <Button size="lg" block variant="secondary" onClick={() => navigate('/inscription/courriel?mode=connexion')}>
            Se connecter
          </Button>
          {/* Only while the app *is* a demo. Connected to a back-end there is no such
              account, and a button that signs nobody in is worse than no button. */}
          {isLive ? null : (
            <Button block variant="ghost" onClick={exploreDemo} loading={busy}>
              Explorer la démo
            </Button>
          )}
        </div>
        <p className={`t-label ${styles.footer}`}>
          <Link to="/entreprise">À propos de Keewal Meere</Link>
        </p>
      </div>

      <div className={styles.toasts} />
    </div>
  )
}

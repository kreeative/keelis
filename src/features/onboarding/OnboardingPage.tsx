/**
 * Inscription — one question per screen.
 * A hairline progress bar spans the top, the back arrow returns to the previous
 * question (or to /bienvenue), and the answers are persisted after every step so
 * a reload resumes exactly where the person stopped.
 *
 * **On a laptop it is laid out the way the reference's sign-up is.** The owner put
 * Wealthsimple's desktop sign-up beside ours: theirs is a page — the wordmark at the top
 * left, « Already have an account? Log in » at the top right, the question set large near
 * the top of a narrow column, a legal line under the button and a footer — and ours was the
 * phone's column parked in the middle of a 1440px screen with a back arrow and a moon over
 * it and nothing else. From 768px the header spans the page and carries the brand and the
 * way in for somebody who already has an account; the back arrow moves into the column
 * above the question, where the reference puts it on its later steps, and is absent on the
 * first, where there is nothing to go back to that the header does not already offer. The
 * phone keeps exactly the flow it had.
 */
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Button, ErrorState, Icon, ProgressBar, Skeleton, Wordmark } from '@/components'
import { useSettings } from '@/store'
import { StepAddress } from './StepAddress'
import { StepBirth } from './StepBirth'
import { StepCode } from './StepCode'
import { StepDocument } from './StepDocument'
import { StepEmail } from './StepEmail'
import { StepName } from './StepName'
import { StepPin } from './StepPin'
import { StepProduct } from './StepProduct'
import { StepTwoFactor } from './StepTwoFactor'
import { STEP_COUNT, isStepSlug, previousStep, resumeSlug, stepIndex, type StepSlug } from './steps'
import { WizardProvider, useWizard } from './wizard'
import styles from './OnboardingPage.module.css'

/** Two screens only when signing in: courriel, then code. */
const SIGN_IN_STEPS = 2

function currentSlug(pathname: string): StepSlug | null {
  const segment = pathname.split('/')[2]
  return isStepSlug(segment) ? segment : null
}

function StepSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <Skeleton width={96} height={12} />
      <Skeleton width="80%" height="var(--fs-h1)" />
      <Skeleton width="100%" height={44} />
    </div>
  )
}

function Wizard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { resolved, setTheme } = useSettings()
  const { ready, error, data, reload } = useWizard()

  const connexion = new URLSearchParams(location.search).get('mode') === 'connexion'
  const slug = currentSlug(location.pathname)
  const index = slug ? stepIndex(slug) : 0
  const total = connexion ? SIGN_IN_STEPS : STEP_COUNT
  const shown = Math.min(index + 1, total)
  const query = connexion ? '?mode=connexion' : ''
  const previous = slug ? previousStep(slug) : null
  const back = previous ? `/inscription/${previous}${query}` : '/bienvenue'

  return (
    <div className={styles.root}>
      <ProgressBar className={styles.progress} value={shown / total} label={`Étape ${shown} sur ${total}`} />
      <header className={styles.top}>
        {/* One control per side on a phone; the brand and the sign-in link join from 768px.
            The phone's arrow and the laptop's are two elements because they sit in two
            places — the bar and the column — and CSS shows the one for the width, so the
            document never carries two focusable « Retour » at once. */}
        <div className={styles.side}>
          <Button variant="ghost" iconOnly aria-label="Retour" onClick={() => navigate(back)} className={styles.back}>
            <Icon name="arrow-left" />
          </Button>
          <Link to="/bienvenue" className={styles.brand} aria-label="Keewal Meere — accueil">
            <Wordmark size="md" />
          </Link>
        </div>
        <div className={styles.side}>
          {connexion ? null : (
            <span className={`t-small ${styles.haveAccount}`}>
              Déjà un compte ?{' '}
              <Link to="/bienvenue" className={styles.link}>
                Se connecter
              </Link>
            </span>
          )}
          <Button variant="ghost" iconOnly aria-label="Basculer le thème" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} className={styles.theme}>
            <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
          </Button>
        </div>
      </header>
      <div className={styles.frame}>
        <main className={styles.main}>
          {previous ? (
            <Button variant="ghost" icon={<Icon name="arrow-left" size={18} />} onClick={() => navigate(back)} className={styles.backInline}>
              Retour
            </Button>
          ) : null}
          {error && !ready ? (
            <ErrorState error={error} onRetry={reload} />
          ) : !ready ? (
            <StepSkeleton />
          ) : (
            <Routes>
              <Route index element={<Navigate to={`/inscription/${resumeSlug(data)}${query}`} replace />} />
              <Route path="courriel" element={<StepEmail />} />
              <Route path="code" element={<StepCode />} />
              <Route path="nom" element={<StepName />} />
              <Route path="naissance" element={<StepBirth />} />
              <Route path="adresse" element={<StepAddress />} />
              <Route path="piece" element={<StepDocument />} />
              <Route path="deux-facteurs" element={<StepTwoFactor />} />
              <Route path="nip" element={<StepPin />} />
              <Route path="produit" element={<StepProduct />} />
              <Route path="*" element={<Navigate to="/inscription/courriel" replace />} />
            </Routes>
          )}
        </main>
        {/* The reference closes its sign-up with a line of legal small print. Ours says the
            one thing this product must never be vague about, the sentence /entreprise leads
            with, and links to the page that says the rest. Laptop only: on a phone the
            action is pinned to the thumb and a footer under it would push it up. */}
        <footer className={`t-small t-muted ${styles.foot}`}>
          Keewal Meere ne détient pas d’argent, n’exécute aucun ordre et n’est agréée par aucune autorité.{' '}
          <Link to="/entreprise" className={styles.link}>
            À propos
          </Link>
        </footer>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <WizardProvider>
      <Wizard />
    </WizardProvider>
  )
}

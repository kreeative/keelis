/**
 * Inscription — one question per screen.
 * A hairline progress bar spans the top, the back arrow returns to the previous
 * question (or to /bienvenue), and the answers are persisted after every step so
 * a reload resumes exactly where the person stopped.
 */
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Button, ErrorState, Icon, ProgressBar, Skeleton } from '@/components'
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
      <div className={styles.frame}>
        <header className={styles.top}>
          <Button variant="ghost" iconOnly aria-label="Retour" onClick={() => navigate(back)} className={styles.back}>
            <Icon name="arrow-left" />
          </Button>
          <Button variant="ghost" iconOnly aria-label="Basculer le thème" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} className={styles.theme}>
            <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
          </Button>
        </header>
        <main className={styles.main}>
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

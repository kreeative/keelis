/**
 * Profil d'investisseur — four questions, and what the answers change.
 *
 * The roadmap asks for this « avant de débloquer les classes d'actifs complexes », and the
 * word *débloquer* is the one thing this screen does not do. Refusing an adult the use of
 * their own money is a posture, not a protection; what actually helps is a sentence in the
 * right place, which is this product's rule everywhere else — warn before, not after, while
 * the decision is still open.
 *
 * So the result is honest about its own consequences: it says exactly what the app will do
 * differently, which for two of the three profiles is « prévenir, et rien de plus ». A
 * questionnaire whose effect is invisible is a questionnaire nobody should bother filling.
 *
 * Every question carries *why it is asked*. Unexplained questions about money read as a
 * test, and somebody who suspects they are being scored answers what they think is wanted.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { ApiError, type RiskProfile } from '@/api/types'
import { Badge, Button, Callout, Card, ChoiceList, ErrorState, Icon, PageHeader, Skeleton } from '@/components'
import { RISK_LEVELS, RISK_MAX, RISK_QUESTIONS, isComplete, levelForAnswers, scoreAnswers } from '@/lib/risk'
import { formatDate } from '@/lib/format'
import { QK, invalidate, useQuery, useSettings } from '@/store'
import styles from './RiskPage.module.css'

export default function RiskPage() {
  const navigate = useNavigate()
  const { locale } = useSettings()
  const saved = useQuery<RiskProfile | null>(QK.risk, () => api.profile.risk())
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  /* The saved answers seed the form, so reopening the questionnaire shows what was said
     rather than an empty page that has to be rebuilt from memory. */
  const current = useMemo(() => ({ ...(saved.data?.answers ?? {}), ...answers }), [saved.data, answers])
  const complete = isComplete(current)
  const preview = complete ? RISK_LEVELS[levelForAnswers(current)] : null

  const submit = async () => {
    setPending(true)
    setError(null)
    try {
      await api.profile.setRisk(current)
      invalidate(QK.risk)
      setEditing(false)
      setAnswers({})
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('Le profil n’a pas pu être enregistré.', 'unknown'))
    } finally {
      setPending(false)
    }
  }

  if (saved.loading && saved.data === undefined) {
    return (
      <div className={styles.page} data-cascade>
        <PageHeader back="/profil" title="Profil d’investisseur" />
        <Skeleton height={96} shape="card" />
      </div>
    )
  }

  if (saved.error && saved.data === undefined) {
    return (
      <div className={styles.page} data-cascade>
        <PageHeader back="/profil" title="Profil d’investisseur" />
        <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />
      </div>
    )
  }

  // Already answered, and not being changed: show the result rather than the form again.
  if (saved.data && !editing) {
    const level = RISK_LEVELS[saved.data.level]
    return (
      <div className={styles.page} data-cascade>
        <PageHeader back="/profil" title="Profil d’investisseur" />
        <Card padding="lg" elevation={1} className={styles.result}>
          <Badge tone="neutral" size="xs">
            Votre profil
          </Badge>
          <h2 className={styles.level}>{level.name}</h2>
          <p className={styles.summary}>{level.summary}</p>
          <p className={styles.effect}>
            <Icon name="info" size={16} className={styles.effectIcon} />
            {level.effect}
          </p>
          <p className={styles.answered}>Répondu le {formatDate(saved.data.completedAt, { locale, style: 'medium' })}.</p>
        </Card>
        <Button variant="secondary" onClick={() => setEditing(true)} className={styles.again}>
          Refaire le questionnaire
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.page} data-cascade>
      <PageHeader back="/profil" title="Profil d’investisseur" />
      <p className={styles.intro}>
        Quatre questions. Elles ne donnent accès à rien et n’interdisent rien : elles décident de ce
        que l’application vous rappelle avant un ordre.
      </p>

      <div className={styles.questions}>
        {RISK_QUESTIONS.map((q, i) => (
          <section key={q.id} className={styles.question} aria-labelledby={`q-${q.id}`}>
            <p className="t-label">Question {i + 1} sur {RISK_QUESTIONS.length}</p>
            <h2 className={styles.prompt} id={`q-${q.id}`}>
              {q.question}
            </h2>
            {/* Why it is asked. An unexplained question about money reads as a test, and
                somebody who thinks they are being scored answers what they think is wanted. */}
            <p className={styles.why}>{q.why}</p>
            <Card padding="none" elevation={1}>
              <ChoiceList
                label={q.question}
                value={current[q.id] ?? null}
                onChange={(value) => setAnswers((a) => ({ ...a, [q.id]: value }))}
                options={q.answers.map((a) => ({ value: a.id, title: a.label }))}
              />
            </Card>
          </section>
        ))}
      </div>

      {preview ? (
        <Callout variant="panel" icon="info" title={`Profil : ${preview.name}`}>
          {preview.effect} Score {scoreAnswers(current)} sur {RISK_MAX}, chaque réponse valant de 0 à 2.
        </Callout>
      ) : null}

      {error ? <ErrorState compact error={error} onRetry={() => void submit()} /> : null}

      <div className={styles.actions}>
        <Button size="lg" block disabled={!complete} loading={pending} onClick={() => void submit()}>
          Enregistrer mon profil
        </Button>
        {saved.data ? (
          <Button variant="ghost" block onClick={() => { setEditing(false); setAnswers({}) }}>
            Annuler
          </Button>
        ) : (
          <Button variant="ghost" block onClick={() => navigate('/profil')}>
            Plus tard
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * The front door, and now the sign-in.
 *
 * Built on the anatomy the owner pointed at twice: a row of spaced micro-labels across the
 * top, the mark and a light sentence, a photograph dissolving out of the page, and a rounded
 * sheet riding up over the frame. What the second look added is what the sheet *carries*.
 * It held three buttons — create, sign in, demo — and the reference holds the sign-in
 * itself: two pill fields with a disc for their icon, the secondary action as a small pill
 * *inside* the field it acts on, one call to action, and « create an account » as a line of
 * text under it. Ours sent somebody to a separate screen to type their address, then to a
 * third to type the code. For the person the app is for, signing in is the front door; a
 * front door with a button that leads to a door is a hallway.
 *
 * **The code is requested from inside its own field.** Where the reference puts « I forgot »
 * — the thing you press when you cannot fill the field — we put « Recevoir », because a
 * code you have not been sent yet is the same situation: the field cannot be filled until
 * that pill is pressed. After the first send it reads « Renvoyer ». The one pill covers both
 * cases, at the end of the line it acts on.
 *
 * **The call to action stays gold.** The reference's is black; the brand's primary button is
 * the butter gold in both themes and `CLAUDE.md` says the brand outranks the kit. The small
 * pill inside the field is ink, which is the reference's own colour for it — that one is a
 * secondary action, and two gold fills on one sheet would say nothing about which to press.
 *
 * **It holds its shape with no photograph at all.** Until the licensed image lands, the hero
 * is simply absent and the sheet rises to meet the type — a quieter version of the same
 * screen, not a broken one.
 */
import { startTransition, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, isLive } from '@/api'
import { Button, Field, Icon, Photo, Wordmark, hasPhoto } from '@/components'
import { useSession, useSettings, useToast } from '@/store'
import { DEMO_CODE, DEMO_EMAIL } from './demo'
import { asApiError } from './wizard'
import styles from './WelcomePage.module.css'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const CODE_LENGTH = 6

/** « 246 810 » — grouped for reading, never for typing. */
function groupCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`
}

export default function WelcomePage() {
  const navigate = useNavigate()
  const { setSession } = useSession()
  const { resolved, setTheme } = useSettings()
  const { toast } = useToast()
  const illustrated = hasPhoto('welcome')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  /** The address the code was sent to — the pill reads « Renvoyer » only for that one. */
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [devHint, setDevHint] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  const address = email.trim()
  const emailValid = EMAIL_RE.test(address)
  const sent = sentTo !== null && sentTo === address
  const codeComplete = code.length === CODE_LENGTH

  const requestCode = async () => {
    if (!emailValid || sending) return
    setSending(true)
    setEmailError(null)
    setCodeError(null)
    try {
      const result = await api.auth.requestCode(address)
      setDevHint(result.devHint ?? null)
      setSentTo(address)
      setCode('')
      /* The next thing to do is type the code, so the focus goes there — after a press on
         the pill, which is a real gesture, not on arrival. `preventScroll` because on a
         phone the keyboard is already up and the field is already in view. */
      codeRef.current?.focus({ preventScroll: true })
    } catch (err) {
      const apiErr = asApiError(err, 'Impossible d’envoyer le code. Réessayez.')
      setEmailError(apiErr.details?.email ?? apiErr.message)
    } finally {
      setSending(false)
    }
  }

  const signIn = async () => {
    if (!emailValid || !codeComplete || busy) return
    setBusy(true)
    setCodeError(null)
    try {
      const result = await api.auth.verifyCode(address, code)
      if (result.session) {
        const session = result.session
        startTransition(() => {
          setSession(session)
          navigate('/', { replace: true })
        })
        return
      }
      /* The code was right and there is no account behind the address: the server has
         opened an onboarding for it, and `/inscription` resumes from wherever that stands.
         Nobody is told « wrong address » for an address that is simply new. */
      navigate('/inscription')
    } catch (err) {
      const apiErr = asApiError(err, 'Impossible de vérifier le code.')
      setCodeError(apiErr.details?.code ?? apiErr.message)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  /* Enter does the next thing, whichever it is: with a code typed it signs in; with only an
     address it asks for the code. A form whose Enter key is refused because the *second*
     field is empty is a form that punishes the person who reads left to right. */
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (codeComplete) void signIn()
    else if (emailValid && !sent) void requestCode()
  }

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

  /* Only once something has been sent. Before that the placeholder and the pill already say
     what the field is, and a line explaining it would cost the height that keeps the button
     on the first screen of a phone. */
  const codeHint = sent ? (devHint ? `Code de démonstration : ${groupCode(devHint)}` : `Code envoyé à ${address}.`) : undefined

  return (
    <div className={`${styles.root} ${illustrated ? styles.illustrated : ''}`}>
      {/* The spaced micro-label row. `.t-label` is already 12px uppercase tracked +0.135em —
          the app's true micro-annotation role — so this is the existing type scale used for
          the job it was defined for, not a new one. The name is a label rather than the
          wordmark because the mark itself is directly below it, and a brand said twice in
          forty pixels is a brand said once too often. The theme toggle is a filled disc, the
          reference's own top-right control: an outline button in a row of labels reads as a
          fourth label. */}
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
        {/* Light, not demi: the reference sets its welcome line thin, and at this size a
            600 sentence over a photograph is a headline where a greeting is wanted. The one
            heading in the app that takes the body weight, and it is the one that is not a
            heading about anything — it is hello. */}
        <h1 className={`t-h1 ${styles.title}`}>Vos francs, votre épargne, vos placements.</h1>
      </div>

      {/* `sizes` is the screen's real measure, not `100vw`: the column caps at 520px, so a
          phone that fetched for the viewport would pull the wider file for nothing.

          **`dissolve`, not `scrim`.** Nothing sits on this frame — the sheet covers its foot
          — so there is no type to protect, and what it needed was the opposite: the page's
          colour poured over the top edge so the picture has no line where it starts. */}
      <Photo name="welcome" className={styles.hero} sizes="(min-width: 520px) 520px, 100vw" dissolve priority />

      <form className={styles.sheet} onSubmit={submit} noValidate aria-label="Connexion">
        <p className={`t-small t-muted ${styles.hello}`}>Bonjour. Connectez-vous à votre compte.</p>

        <div className={styles.fields}>
          <Field
            pill
            chip
            label="Adresse courriel"
            hideLabel
            leading={<Icon name="mail" size={18} />}
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="Adresse courriel"
            value={email}
            error={emailError ?? undefined}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError(null)
            }}
          />
          {/* The reference's second field carries its escape hatch inside it — « I forgot »
              as a small dark pill at the end of the line. Ours is « Recevoir »: a code is not
              something you forget, it is something you have not been sent yet, and the pill
              is what sends it. The field is not disabled before that, because a code that
              arrived by another route (an SMS, a second device) should still be typeable. */}
          <Field
            pill
            chip
            ref={codeRef}
            label="Code à six chiffres"
            hideLabel
            leading={<Icon name="lock-keyhole" size={18} />}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            placeholder="Code reçu"
            value={code}
            hint={codeHint}
            error={codeError ?? undefined}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
              setCodeError(null)
            }}
            trailing={
              <Button variant="secondary" className={styles.inField} onClick={() => void requestCode()} disabled={!emailValid || busy} loading={sending}>
                {sent ? 'Renvoyer' : 'Recevoir'}
              </Button>
            }
          />
        </div>

        <div className={styles.actions}>
          <Button type="submit" size="lg" block disabled={!emailValid || !codeComplete} loading={busy}>
            Se connecter
          </Button>
          {/* A destination, so a real link: it has to survive a long-press and a middle-click. */}
          <Button block variant="ghost" to="/inscription/courriel">
            Créer un compte
          </Button>
        </div>

        <p className={`t-label ${styles.footer}`}>
          {/* Only while the app *is* a demo. Connected to a back-end there is no such
              account, and a button that signs nobody in is worse than no button. */}
          {isLive ? null : (
            <>
              <button type="button" className={styles.footerLink} onClick={() => void exploreDemo()} disabled={busy}>
                Explorer la démo
              </button>
              <span aria-hidden="true">·</span>
            </>
          )}
          <Link to="/entreprise" className={styles.footerLink}>
            À propos
          </Link>
        </p>
      </form>

      <div className={styles.toasts} />
    </div>
  )
}

/**
 * /profil/informations — the screen that lets somebody correct their own details.
 *
 * **It did not exist.** `api.profile.update` has always accepted a name, a phone number and
 * an address, and exactly one caller ever used it — the language toggle, for `locale`. So a
 * person who moved house, married, or simply mistyped their name at sign-up had nowhere in
 * the app to say so. An endpoint with no screen is the same defect as a button with no
 * handler, read from the other end.
 *
 * Two fields are deliberately **not** editable, and both say why on the screen rather than
 * being quietly greyed out:
 *
 * - **The e-mail is the credential you sign in with.** Moving it is a verification flow —
 *   prove the new address, prove it is still you — not a text field and a Save. The API's
 *   own `update` refuses it, which is the contract agreeing.
 * - **The date of birth is what the identity check ran against.** Editing it afterwards is
 *   either meaningless or fraud; on a verified account it is a re-verification.
 *
 * The name carries its warning *before* the field rather than after the save, per the app's
 * « warn before, not after » rule: on a verified account a new name is checked again, and
 * that is worth knowing while the decision is still open.
 */
import { useEffect, useRef, useState } from 'react'
import { api, ApiError, type Locale } from '@/api'
import type { User } from '@/api/types'
import { Button, Callout, Card, Field, Icon, PageHeader } from '@/components'
import { AddressFields, addressIncomplete, emptyAddress, postalProblem, type AddressDraft } from '@/features/shared'
import { formatDate } from '@/lib/format'
import { QK, setQueryData, useQuery, useSession, useSettings, useToast } from '@/store'
import styles from './PersonalInfoPage.module.css'

/**
 * The two facts this screen refuses to change, each with the reason said out loud.
 *
 * Greying a field out without a word is the version of this that makes somebody think the
 * app is broken; the reason is the difference between a wall and a door marked « not here ».
 */
const FIXED: ReadonlyArray<{ label: string; value: (u: User | null, locale: Locale) => string; why: string }> = [
  {
    label: 'Adresse e-mail',
    value: (u) => u?.email ?? '—',
    why: 'C’est l’identifiant avec lequel vous vous connectez. En changer demande de vérifier la nouvelle adresse — écrivez-nous depuis l’aide.',
  },
  {
    label: 'Date de naissance',
    value: (u, locale) => (u?.dateOfBirth ? formatDate(u.dateOfBirth, { locale }) : '—'),
    why: 'C’est ce sur quoi votre identité a été vérifiée. La corriger est une revérification, pas une modification.',
  },
]

export default function PersonalInfoPage() {
  const { user: session, refreshUser } = useSession()
  /* **The form is seeded from `profile.me()`, not from the session.** The session is a
     snapshot written at sign-in and kept for auth; it can predate anything the person has
     changed since, and on an account whose address was added later it is simply missing —
     which opens this form blank with Save greyed out and nothing saying why. The server's
     copy is the one that is true. The session stays as the fallback so the fields are
     populated on the first frame rather than after a round trip. */
  const me = useQuery<User>(QK.me, () => api.profile.me())
  const user = me.data ?? session
  const { locale } = useSettings()
  const { toast } = useToast()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState<AddressDraft>(() => emptyAddress())
  const [postalError, setPostalError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * The server's copy fills the form **until the person starts typing**, and never after.
   *
   * Both halves were wrong in turn. Re-seeding on every `me.data` meant a background refetch
   * landed mid-sentence and put the stored values back over what somebody had entered —
   * silently, so the only symptom was a Save that appeared to do nothing, and a flow that
   * passed two runs in four. Seeding strictly once then meant seeding from the *session*,
   * which is a snapshot that can predate the address entirely: the form opened blank and
   * Save never enabled.
   *
   * So the condition is neither « once » nor « whenever »: it is « has this person touched
   * it ». A ref, because that is not a value React can compare, and because it must not
   * cause a render of its own.
   */
  const dirty = useRef(false)
  useEffect(() => {
    if (dirty.current || !user) return
    setFirstName(user.firstName)
    setLastName(user.lastName)
    setPhone(user.phone ?? '')
    setAddress(emptyAddress(user.address))
  }, [user])

  /** Every edit goes through here, so nothing can change a field without saying so. */
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    dirty.current = true
    set(v)
  }

  const nameChanged = !!user && (firstName.trim() !== user.firstName || lastName.trim() !== user.lastName)
  const valid = firstName.trim().length > 0 && lastName.trim().length > 0 && !addressIncomplete(address)

  async function save() {
    if (!valid || busy) return
    const problem = postalProblem(address)
    if (problem) {
      setPostalError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = await api.profile.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        address: {
          line1: address.line1.trim(),
          line2: address.line2.trim() || undefined,
          city: address.city.trim(),
          province: address.province.trim(),
          postalCode: address.postalCode,
          country: address.country,
        },
      })
      /* Both copies, or the next visit reads a stale one. `refreshUser` updates the session
         (the avatar, the greeting, the profile header); `setQueryData` updates the cache this
         very form seeds itself from — without it, navigating away and back showed the old
         name while the header beside it showed the new one. The server's own response is
         what goes in, not the patch that was sent: it is the copy that won. */
      await refreshUser()
      setQueryData<User>(QK.me, () => saved)
      toast('Informations enregistrées')
    } catch (err) {
      /* The four codes every flow in this app branches on, so a refused save reads the way a
         refused transfer does rather than as a stack trace. */
      setError(
        err instanceof ApiError
          ? err.code === 'offline' || err.code === 'network'
            ? 'Pas de connexion. Vos modifications n’ont pas été envoyées.'
            : err.message
          : 'Impossible d’enregistrer pour l’instant.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <PageHeader back="/profil" title="Informations personnelles" />

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <section className={styles.section} aria-labelledby="pi-identity">
          <h2 className="t-section" id="pi-identity">
            Identité
          </h2>
          {nameChanged && user?.verified ? (
            <Callout className={styles.callout}>
              Votre compte est vérifié. Un changement de nom est revérifié avant d’apparaître sur vos relevés.
            </Callout>
          ) : null}
          <div className={styles.fields}>
            <Field label="Prénom" autoComplete="given-name" value={firstName} onChange={(e) => edit(setFirstName)(e.target.value)} />
            <Field label="Nom" autoComplete="family-name" value={lastName} onChange={(e) => edit(setLastName)(e.target.value)} />
            <Field
              label="Téléphone"
              type="tel"
              autoComplete="tel"
              hint="Facultatif. Sert aux alertes et à la récupération du compte."
              value={phone}
              onChange={(e) => edit(setPhone)(e.target.value)}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="pi-address">
          <h2 className="t-section" id="pi-address">
            Adresse
          </h2>
          <AddressFields
            className={styles.fields}
            value={address}
            onChange={(next) => {
              edit(setAddress)(next)
              setPostalError(null)
              setError(null)
            }}
            postalError={postalError}
          />
        </section>

        {/* What this screen cannot change, and why — said out loud, not greyed out without a word. */}
        <section className={styles.section} aria-labelledby="pi-fixed">
          <h2 className="t-section" id="pi-fixed">
            Non modifiable ici
          </h2>
          {/* A definition list, not `ListRow`s. A row's value slot is `flex-shrink: 0` — right
              for money, where the figure is the reason for the row and must never give up
              width — and wrong for « aissatou.ndiaye@exemple.sn », which is 237px of
              unbreakable string and pushed the page three pixels past a 320px screen. These
              two are not rows with a trailing value anyway: they are a fact and the reason
              it is fixed. */}
          <Card elevation={1}>
            <dl className={styles.fixed}>
              {FIXED.map((f) => (
                <div key={f.label} className={styles.fixedItem}>
                  <dt className="t-name">{f.label}</dt>
                  <dd className={styles.fixedValue}>{f.value(user, locale)}</dd>
                  <p className={styles.fixedWhy}>{f.why}</p>
                </div>
              ))}
            </dl>
          </Card>
        </section>

        {error ? (
          <p className={styles.error} role="alert">
            <Icon name="circle-alert" size={16} />
            <span>{error}</span>
          </p>
        ) : null}

        <div className={styles.actions}>
          <Button type="submit" size="lg" block disabled={!valid} loading={busy} icon={<Icon name="check" size={18} />}>
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  )
}

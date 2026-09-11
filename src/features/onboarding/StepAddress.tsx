import { useState } from 'react'
import { Field, Icon, SelectField } from '@/components'
import { StepShell } from './StepShell'
import { useStepFocus } from './useStepFocus'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import styles from './Steps.module.css'

const PROVINCES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'Colombie-Britannique' },
  { code: 'PE', name: 'Île-du-Prince-Édouard' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'Nouveau-Brunswick' },
  { code: 'NS', name: 'Nouvelle-Écosse' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'QC', name: 'Québec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'NL', name: 'Terre-Neuve-et-Labrador' },
  { code: 'NT', name: 'Territoires du Nord-Ouest' },
  { code: 'YT', name: 'Yukon' },
]

const POSTAL_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] \d[ABCEGHJ-NPRSTV-Z]\d$/

/** Uppercase and insert the single space: "h2j2w9" → "H2J 2W9". */
function formatPostal(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean
}

export function StepAddress() {
  const { data, save, goNext } = useWizard()
  const focusRef = useStepFocus()
  const address = data.address
  const [line1, setLine1] = useState(address?.line1 ?? '')
  const [line2, setLine2] = useState(address?.line2 ?? '')
  const [city, setCity] = useState(address?.city ?? '')
  const [province, setProvince] = useState(address?.province ?? '')
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? '')
  const [postalError, setPostalError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const valid = line1.trim().length > 0 && city.trim().length > 0 && province.length > 0 && postalCode.length > 0

  const submit = async () => {
    if (!POSTAL_RE.test(postalCode)) {
      setPostalError('Entrez un code postal valide (A1A 1A1).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await save({
        address: { line1: line1.trim(), line2: line2.trim() || undefined, city: city.trim(), province, postalCode, country: 'CA' },
        step: 'document',
      })
      goNext('adresse')
    } catch (err) {
      setError(asApiError(err, 'Impossible d’enregistrer votre adresse.').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell
      eyebrow={stepEyebrow('adresse')}
      title="Où habitez-vous ?"
      description="Votre adresse résidentielle au Canada, pas une case postale."
      submitDisabled={!valid}
      submitting={busy}
      onSubmit={() => void submit()}
    >
      <div className={styles.fields}>
        <Field label="Adresse" autoComplete="address-line1" ref={focusRef} value={line1} onChange={(e) => setLine1(e.target.value)} />
        <Field label="Appartement" hint="Facultatif" autoComplete="address-line2" value={line2} onChange={(e) => setLine2(e.target.value)} />
        <Field label="Ville" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
        <div className={styles.select}>
          <SelectField label="Province ou territoire" autoComplete="address-level1" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="" disabled>
              Choisir
            </option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <Icon name="chevron-down" size={18} className={styles.selectChevron} />
        </div>
        <Field
          label="Code postal"
          autoComplete="postal-code"
          inputMode="text"
          spellCheck={false}
          placeholder="A1A 1A1"
          maxLength={7}
          value={postalCode}
          error={postalError ?? undefined}
          onChange={(e) => {
            setPostalCode(formatPostal(e.target.value))
            setPostalError(null)
            setError(null)
          }}
        />
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </StepShell>
  )
}

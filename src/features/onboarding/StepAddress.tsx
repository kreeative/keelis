import { useMemo, useState } from 'react'
import { Field, Icon, SelectField } from '@/components'
import { StepShell } from './StepShell'
import { useStepFocus } from './useStepFocus'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import { COUNTRIES, DEFAULT_COUNTRY, country as countryFor } from './places'
import styles from './Steps.module.css'

export function StepAddress() {
  const { data, save, goNext } = useWizard()
  const focusRef = useStepFocus()
  const address = data.address
  const [line1, setLine1] = useState(address?.line1 ?? '')
  const [line2, setLine2] = useState(address?.line2 ?? '')
  const [city, setCity] = useState(address?.city ?? '')
  const [countryCode, setCountryCode] = useState(address?.country || DEFAULT_COUNTRY)
  const [province, setProvince] = useState(address?.province ?? '')
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? '')
  const [postalError, setPostalError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const place = useMemo(() => countryFor(countryCode), [countryCode])

  /* The postal code is required only where one exists. Most of West Africa does not use a
     code in an address, and a mandatory field nobody can fill is the same closed door the
     Canadian-only form was, in a smaller shape. */
  const valid = line1.trim().length > 0 && city.trim().length > 0 && province.trim().length > 0 && (!place.postal || postalCode.length > 0)

  const onCountry = (code: string) => {
    setCountryCode(code)
    // A région belongs to a country: keeping « Québec » selected after switching to Sénégal
    // would submit an address that exists nowhere.
    setProvince('')
    setPostalCode('')
    setPostalError(null)
  }

  const submit = async () => {
    if (place.postal && !place.postal.test.test(postalCode)) {
      setPostalError(place.postal.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await save({
        address: { line1: line1.trim(), line2: line2.trim() || undefined, city: city.trim(), province: province.trim(), postalCode, country: countryCode },
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
      description="Votre adresse résidentielle, pas une boîte postale."
      submitDisabled={!valid}
      submitting={busy}
      onSubmit={() => void submit()}
    >
      <div className={styles.fields}>
        {/* Country first: it decides what the two fields below even are. */}
        <div className={styles.select}>
          <SelectField label="Pays" autoComplete="country-name" value={countryCode} onChange={(e) => onCountry(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <Icon name="chevron-down" size={18} className={styles.selectChevron} />
        </div>
        <Field label="Adresse" autoComplete="address-line1" ref={focusRef} value={line1} onChange={(e) => setLine1(e.target.value)} />
        <Field label="Appartement" hint="Facultatif" autoComplete="address-line2" value={line2} onChange={(e) => setLine2(e.target.value)} />
        <Field label="Ville" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
        {place.regions ? (
          <div className={styles.select}>
            <SelectField label={place.regionLabel} autoComplete="address-level1" value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="" disabled>
                Choisir
              </option>
              {place.regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectField>
            <Icon name="chevron-down" size={18} className={styles.selectChevron} />
          </div>
        ) : (
          /* No list for this country: a free field beats a wrong list. */
          <Field label={place.regionLabel} autoComplete="address-level1" value={province} onChange={(e) => setProvince(e.target.value)} />
        )}
        {place.postal ? (
          <Field
            label={place.postal.label}
            autoComplete="postal-code"
            inputMode="text"
            spellCheck={false}
            placeholder={place.postal.placeholder}
            maxLength={10}
            value={postalCode}
            error={postalError ?? undefined}
            onChange={(e) => {
              setPostalCode(place.postal?.format ? place.postal.format(e.target.value) : e.target.value)
              setPostalError(null)
              setError(null)
            }}
          />
        ) : null}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </StepShell>
  )
}

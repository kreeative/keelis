/**
 * The six controls that make up an address, owned in one place.
 *
 * They were written once inside the onboarding wizard, and the moment `/profil/informations`
 * needed the same form there were two of them — two copies of « clear the région when the
 * country changes », two copies of which countries have a postal code and what shape it is.
 * That is how a Sénégalais address ends up valid on one screen and refused on the other.
 *
 * The rules travel with the fields: `addressIncomplete` says what is still missing and
 * `postalProblem` says whether the code is the wrong shape, so a caller decides *when* to
 * enforce them without re-deriving *what* they are.
 */
import { forwardRef, useMemo } from 'react'
import { Field, Picker } from '@/components'
import { COUNTRIES, DEFAULT_COUNTRY, country as countryFor } from '@/lib/places'

export interface AddressDraft {
  line1: string
  line2: string
  city: string
  province: string
  postalCode: string
  country: string
}

export function emptyAddress(seed?: Partial<AddressDraft>): AddressDraft {
  return {
    line1: seed?.line1 ?? '',
    line2: seed?.line2 ?? '',
    city: seed?.city ?? '',
    province: seed?.province ?? '',
    postalCode: seed?.postalCode ?? '',
    country: seed?.country || DEFAULT_COUNTRY,
  }
}

/**
 * True when a required field is still empty.
 *
 * The postal code is required **only where one exists**: most of West Africa does not use
 * one, and a mandatory field nobody can fill is the same closed door the Canada-only form
 * was, in a smaller shape.
 */
export function addressIncomplete(a: AddressDraft): boolean {
  const place = countryFor(a.country)
  return a.line1.trim().length === 0 || a.city.trim().length === 0 || a.province.trim().length === 0 || (!!place.postal && a.postalCode.length === 0)
}

/** The postal code's own complaint, or null. Separate from the above so it can be shown on submit rather than while typing. */
export function postalProblem(a: AddressDraft): string | null {
  const place = countryFor(a.country)
  if (!place.postal) return null
  return place.postal.test.test(a.postalCode) ? null : place.postal.error
}

export interface AddressFieldsProps {
  value: AddressDraft
  onChange: (next: AddressDraft) => void
  /** Shown on the postal field; the caller clears it as the person types. */
  postalError?: string | null
  className?: string
}

export const AddressFields = forwardRef<HTMLInputElement, AddressFieldsProps>(function AddressFields({ value, onChange, postalError, className }, ref) {
  const place = useMemo(() => countryFor(value.country), [value.country])
  const set = (patch: Partial<AddressDraft>) => onChange({ ...value, ...patch })

  return (
    <div className={className}>
      {/* Country first: it decides what the two fields below even are. Two hundred and fifty
          of them, which is the whole reason the picker has a search box rather than being a
          wheel somebody spins past Afghanistan to reach Sénégal. */}
      <Picker
        label="Pays"
        value={value.country}
        /* A région belongs to a country: keeping « Québec » selected after switching to
           Sénégal would submit an address that exists nowhere. The postal code goes with it. */
        onChange={(code) => set({ country: code, province: '', postalCode: '' })}
        sheetTitle="Pays de résidence"
        options={COUNTRIES.map((c) => ({ value: c.code, title: c.name }))}
      />
      <Field label="Adresse" autoComplete="address-line1" ref={ref} value={value.line1} onChange={(e) => set({ line1: e.target.value })} />
      <Field label="Appartement" hint="Facultatif" autoComplete="address-line2" value={value.line2} onChange={(e) => set({ line2: e.target.value })} />
      <Field label="Ville" autoComplete="address-level2" value={value.city} onChange={(e) => set({ city: e.target.value })} />
      {place.regions ? (
        <Picker
          label={place.regionLabel}
          value={value.province}
          onChange={(province) => set({ province })}
          sheetTitle={place.regionLabel}
          options={place.regions.map((r) => ({ value: r, title: r }))}
        />
      ) : (
        /* No list for this country: a free field beats a wrong list. */
        <Field label={place.regionLabel} autoComplete="address-level1" value={value.province} onChange={(e) => set({ province: e.target.value })} />
      )}
      {place.postal ? (
        <Field
          label={place.postal.label}
          autoComplete="postal-code"
          inputMode="text"
          spellCheck={false}
          placeholder={place.postal.placeholder}
          maxLength={10}
          value={value.postalCode}
          error={postalError ?? undefined}
          onChange={(e) => set({ postalCode: place.postal?.format ? place.postal.format(e.target.value) : e.target.value })}
        />
      ) : null}
    </div>
  )
})

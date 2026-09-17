/**
 * Where someone opening an account actually lives.
 *
 * The address step used to offer thirteen Canadian provinces and demand a Canadian postal
 * code (`A1A 1A1`), which meant nobody in Dakar could finish signing up for an app whose
 * first screen says « Investir depuis l'Afrique de l'Ouest ». That is not a cosmetic
 * mismatch; it is a closed door.
 *
 * The list leads with the CFA zones because that is where the product is, then the other
 * markets whose currency the app holds, then the diaspora countries the transfer operators
 * already reach — a Senegalese saver in Montréal or Paris is the second audience, not an
 * afterthought.
 *
 * **Postal codes are optional unless we know the rule.** Most of West Africa does not use
 * them in an address, and a required field nobody can fill is the same closed door in a
 * smaller shape. Where a format is known and universal (Canada, France, Senegal), it is
 * checked; everywhere else the field accepts what the person writes.
 */

export interface Country {
  code: string
  name: string
  /** Label for the second administrative line: région, état, province… */
  regionLabel: string
  /** When known, the list to choose from; otherwise the field is free text. */
  regions?: readonly string[]
  postal?: {
    label: string
    placeholder: string
    /** Checked on submit. */
    test: RegExp
    /** The sentence shown when it fails — its own, never a generic "invalide". */
    error: string
    /** Uppercase / space as it is typed. */
    format?: (raw: string) => string
  }
}

/** Senegal's fourteen regions. The home market gets a real list. */
const SENEGAL_REGIONS = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kédougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sédhiou',
  'Tambacounda',
  'Thiès',
  'Ziguinchor',
] as const

const CANADA_REGIONS = [
  'Alberta',
  'Colombie-Britannique',
  'Île-du-Prince-Édouard',
  'Manitoba',
  'Nouveau-Brunswick',
  'Nouvelle-Écosse',
  'Nunavut',
  'Ontario',
  'Québec',
  'Saskatchewan',
  'Terre-Neuve-et-Labrador',
  'Territoires du Nord-Ouest',
  'Yukon',
] as const

const fiveDigits = {
  label: 'Code postal',
  placeholder: '11000',
  test: /^\d{5}$/,
  error: 'Le code postal compte cinq chiffres.',
  format: (raw: string) => raw.replace(/\D/g, '').slice(0, 5),
}

export const COUNTRIES: readonly Country[] = [
  // UEMOA — the franc CFA (XOF) zone.
  { code: 'SN', name: 'Sénégal', regionLabel: 'Région', regions: SENEGAL_REGIONS, postal: fiveDigits },
  { code: 'CI', name: 'Côte d’Ivoire', regionLabel: 'District ou région' },
  { code: 'ML', name: 'Mali', regionLabel: 'Région' },
  { code: 'BF', name: 'Burkina Faso', regionLabel: 'Région' },
  { code: 'BJ', name: 'Bénin', regionLabel: 'Département' },
  { code: 'TG', name: 'Togo', regionLabel: 'Région' },
  { code: 'NE', name: 'Niger', regionLabel: 'Région' },
  { code: 'GW', name: 'Guinée-Bissau', regionLabel: 'Région' },
  // CEMAC — the franc CFA (XAF) zone.
  { code: 'CM', name: 'Cameroun', regionLabel: 'Région' },
  { code: 'GA', name: 'Gabon', regionLabel: 'Province' },
  { code: 'CG', name: 'Congo', regionLabel: 'Département' },
  { code: 'TD', name: 'Tchad', regionLabel: 'Province' },
  { code: 'CF', name: 'République centrafricaine', regionLabel: 'Préfecture' },
  { code: 'GQ', name: 'Guinée équatoriale', regionLabel: 'Province' },
  // The other markets whose currency the app holds.
  { code: 'NG', name: 'Nigeria', regionLabel: 'État' },
  { code: 'GH', name: 'Ghana', regionLabel: 'Région' },
  { code: 'KE', name: 'Kenya', regionLabel: 'Comté' },
  { code: 'TZ', name: 'Tanzanie', regionLabel: 'Région' },
  { code: 'UG', name: 'Ouganda', regionLabel: 'Région' },
  { code: 'RW', name: 'Rwanda', regionLabel: 'Province' },
  { code: 'ET', name: 'Éthiopie', regionLabel: 'Région' },
  { code: 'ZA', name: 'Afrique du Sud', regionLabel: 'Province' },
  { code: 'EG', name: 'Égypte', regionLabel: 'Gouvernorat' },
  { code: 'MA', name: 'Maroc', regionLabel: 'Région' },
  { code: 'DZ', name: 'Algérie', regionLabel: 'Wilaya' },
  { code: 'TN', name: 'Tunisie', regionLabel: 'Gouvernorat' },
  // The diaspora, which the transfer operators already reach.
  {
    code: 'FR',
    name: 'France',
    regionLabel: 'Région',
    postal: fiveDigits,
  },
  {
    code: 'CA',
    name: 'Canada',
    regionLabel: 'Province ou territoire',
    regions: CANADA_REGIONS,
    postal: {
      label: 'Code postal',
      placeholder: 'A1A 1A1',
      test: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] \d[ABCEGHJ-NPRSTV-Z]\d$/,
      error: 'Entrez un code postal valide (A1A 1A1).',
      format: (raw: string) => {
        const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
        return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean
      },
    },
  },
  { code: 'BE', name: 'Belgique', regionLabel: 'Province' },
  { code: 'IT', name: 'Italie', regionLabel: 'Région' },
  { code: 'ES', name: 'Espagne', regionLabel: 'Communauté autonome' },
  { code: 'GB', name: 'Royaume-Uni', regionLabel: 'Comté' },
  { code: 'US', name: 'États-Unis', regionLabel: 'État' },
]

/** The home market, and the default selection. */
export const DEFAULT_COUNTRY = 'SN'

export function country(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]!
}

/**
 * /entreprise — the public page that explains what Keewal Meere is.
 *
 * Modelled on the shape JPMorgan, Schwab and Wealthsimple all use: an editorial hero, then
 * what it does, then why it exists *here*, then what it costs, then what protects the
 * money, then one way in. What is deliberately *not* borrowed is the habit of a number
 * with no source behind it. Every figure on this page is one this codebase can point at —
 * the treaty peg, the spread tiers in `lib/fx.ts`, the currencies in `lib/currency.ts`,
 * the operators in the seed — and where there is nothing to point at, the page says so
 * rather than inventing it.
 *
 * That last part is not modesty. A page that claims an approval it does not hold, or an
 * amount under management it never had, is the one kind of copy a money product cannot
 * write. Hence the footer, which is the most important paragraph here.
 *
 * It sits outside both guards in the route map — a company page that redirects a signed-in
 * visitor to their dashboard is a company page nobody can link to.
 */
import { Button, Card, Icon, Photo, Wordmark } from '@/components'
import { cn } from '@/lib/cn'
import { CURRENCY_ORDER, CURRENCIES, type Currency } from '@/lib/currency'
import { CFA_PER_EUR, SPREADS } from '@/lib/fx'
import { formatNumber, formatPercent } from '@/lib/format'
import { useSettings } from '@/store'
import styles from './CompanyPage.module.css'

/**
 * Figures the codebase can point at. No "milliards sous gestion" — there are none, and a
 * page that invents one is the first lie a money product tells.
 *
 * The peg is *formatted*, never typed as a string: the app's rule is comma groups and a
 * point decimal, so hand-writing the French "655,957" would print six hundred thousand
 * francs to the euro on a page whose whole argument is that the number is exact.
 */
function facts(peg: string) {
  return [
    { value: String(CURRENCY_ORDER.length), label: 'devises, du franc CFA au rand' },
    { value: '15', label: 'canaux d’envoi, Mobile Money compris' },
    { value: '4', label: 'comptes dans une seule application' },
    { value: peg, label: 'le franc CFA par euro, fixé par traité' },
  ]
}

const PRODUCTS = [
  {
    icon: 'chart-line' as const,
    title: 'Actifs',
    body: 'Les actions africaines d’abord — BRVM à Abidjan, NGX à Lagos, JSE à Johannesburg — et la crypto à côté, dans le même compte. Une courbe en ligne partout, des chandeliers OHLC sur grand écran pour qui les lit.',
  },
  {
    icon: 'cheque' as const,
    title: 'Chèque',
    body: 'Un compte courant et une carte. Une dépense apparaît « en attente » à la seconde où elle se fait, puis se règle : pas de solde qui ment pendant trois jours.',
  },
  {
    icon: 'piggy-bank' as const,
    title: 'Épargne',
    body: 'Un compte rémunéré et des objectifs nommés. On met de l’argent de côté pour quelque chose de précis, pas dans le vide.',
  },
  {
    icon: 'transfer' as const,
    title: 'Change',
    body: 'Seize devises, du franc CFA au naira, plus l’euro et le dollar. Le taux du marché, le taux appliqué et la marge sont affichés côte à côte avant que vous confirmiez.',
  },
]

const SAFEGUARDS = [
  {
    icon: 'lock-keyhole' as const,
    title: 'NIP et verrouillage',
    body: 'Un NIP à quatre chiffres, redemandé au retour sur l’application et après une période d’inactivité. La biométrie quand l’appareil la propose.',
  },
  {
    icon: 'eye-off' as const,
    title: 'Mode confidentialité',
    body: 'Un appui masque tous les soldes — y compris pour les lecteurs d’écran, pour qu’un montant ne soit pas lu à voix haute dans un taxi.',
  },
  {
    icon: 'shield-check' as const,
    title: 'Rien sans confirmation',
    body: 'Tout mouvement d’argent passe par un récapitulatif qui montre le montant, les frais et le total, puis par un état de succès explicite.',
  },
]

/**
 * XOF and XAF are both "Franc CFA", so the name alone puts the same label twice in the
 * grid. The zone's acronym is what tells them apart, and it is the first token of the zone
 * string the registry already carries.
 */
function currencyLabel(code: Currency): string {
  const info = CURRENCIES[code]
  if (!info.pegged) return info.name
  const zone = info.zone.split('—')[0]?.trim() ?? ''
  return zone ? `${info.name} · ${zone}` : info.name
}

export default function CompanyPage() {
  const { locale } = useSettings()
  const pct = (v: number) => formatPercent(v * 100, { locale, signed: false })
  const peg = formatNumber(CFA_PER_EUR, { locale, minFraction: 3, maxFraction: 3 })
  const FACTS = facts(peg)

  return (
    <div className={styles.shell}>
      <header className={cn('glass', 'glass-strong', 'elev-2', styles.bar)}>
        <Wordmark size="sm" />
        <Button to="/bienvenue">Ouvrir l’app</Button>
      </header>

      <main className={styles.main}>
        {/* A sentence set large — deliberately a different *kind* of hero from the app's
            screens, which all lead with a number. Here there is no number that is yours
            yet, and a stand-in would be worse than a sentence. */}
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Investir depuis l’Afrique de l’Ouest</p>
          <h1 className={styles.headline}>
            Votre argent devrait comprendre <em>où vous vivez.</em>
          </h1>
          <p className={styles.lede}>
            Les applications d’investissement sont écrites pour des comptes en dollars, des
            virements bancaires et des bourses américaines. Keewal Meere part de l’autre bout : le
            franc CFA, le Mobile Money, et les entreprises cotées près de chez vous.
          </p>
          <div className={styles.heroActions}>
            <Button to="/bienvenue" size="lg">
              Explorer la démo
            </Button>
            <Button to="/bienvenue" size="lg" variant="secondary">
              Créer un compte
            </Button>
          </div>
        </section>

        {/* The band. It is `lazy` and not `priority`: it sits below the hero, so fetching it
            eagerly would put it in front of the type somebody is already reading. Renders
            nothing at all until the owner's licensed file exists, and the page closes up
            around it — the same contract as the welcome screen. */}
        <Photo name="company" className={styles.band} sizes="(min-width: 1120px) 1120px, 100vw" scrim="full" />

        <section className={styles.section} aria-label="En chiffres">
          <Card padding="lg" elevation={1} className={styles.facts}>
            {FACTS.map((f) => (
              <div key={f.label} className={styles.fact}>
                <p className={styles.factValue}>{f.value}</p>
                <p className={styles.factLabel}>{f.label}</p>
              </div>
            ))}
          </Card>
        </section>

        <section className={styles.section} aria-labelledby="produits">
          <h2 id="produits" className={styles.sectionTitle}>
            Quatre comptes, une seule application
          </h2>
          <p className={styles.sectionLede}>
            Placer, dépenser, mettre de côté, changer. Les quatre partagent un solde, un historique
            et une seule façon de confirmer un mouvement.
          </p>
          <div className={styles.grid}>
            {PRODUCTS.map((p) => (
              <Card key={p.title} padding="lg" elevation={1} className={styles.tile}>
                <span className={styles.tileIcon} aria-hidden="true">
                  <Icon name={p.icon} size={24} />
                </span>
                <h3 className={styles.tileTitle}>{p.title}</h3>
                <p className={styles.tileBody}>{p.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* The one section with no card under it: it sits directly on the ambient ground,
            so the page reads as a page and not as a filing cabinet. */}
        <section className={styles.statement} aria-labelledby="peg">
          {/* The sentence is the heading and the figure completes it, so the section's
              accessible name reads "Le franc CFA est arrimé à l'euro à" rather than a bare
              number. The figure is the one thing on this page set at display size. */}
          <h2 className={styles.statementLead} id="peg">
            Le franc CFA est arrimé à l’euro à
          </h2>
          <p className={styles.statementFigure}>{peg}</p>
          <p className={styles.statementBody}>
            Exactement. Par traité, pas par le marché. Une application qui cote cette paire comme si
            elle flottait vous vend du hasard : le taux ne bouge pas, et la seule variable est la
            marge. Nous l’écrivons comme telle — la parité en constante, la marge affichée à part,
            en francs, avant que vous confirmiez.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="prix">
          <h2 id="prix" className={styles.sectionTitle}>
            Ce que ça coûte, dit avant
          </h2>
          <p className={styles.sectionLede}>
            Une marge de change est un frais déguisé en taux. Nous affichons les deux : le taux du
            marché, le taux appliqué, et ce que la différence représente en francs — dans l’écran de
            confirmation, pas dans le relevé du mois suivant.
          </p>
          <Card padding="lg" elevation={1} className={styles.panel}>
            <dl className={styles.priceList}>
              <div className={styles.priceRow}>
                <dt className={styles.priceTerm}>Euro ↔ dollar</dt>
                <dd className={styles.priceValue}>{pct(SPREADS.anchor)}</dd>
              </div>
              <div className={styles.priceRow}>
                <dt className={styles.priceTerm}>Une devise africaine</dt>
                <dd className={styles.priceValue}>{pct(SPREADS.single)}</dd>
              </div>
              <div className={styles.priceRow}>
                <dt className={styles.priceTerm}>Deux devises africaines</dt>
                <dd className={styles.priceValue}>{pct(SPREADS.cross)}</dd>
              </div>
              <div className={styles.priceRow}>
                <dt className={styles.priceTerm}>Franc CFA Ouest ↔ Centre</dt>
                <dd className={styles.priceValue}>{pct(SPREADS.pegged)}</dd>
              </div>
            </dl>
            <p className={styles.priceNote}>
              Les paliers facturent des étapes, pas de l’humeur : une paire majeure se couvre
              facilement, un croisement entre deux devises africaines passe par deux opérations, et
              deux francs CFA arrimés au même euro ne portent aucun risque de taux — seulement deux
              banques centrales à faire se parler. Valeurs de démonstration.
            </p>
          </Card>
        </section>

        <section className={styles.section} aria-labelledby="portee">
          <h2 id="portee" className={styles.sectionTitle}>
            {CURRENCY_ORDER.length} devises, quinze façons d’envoyer
          </h2>
          <p className={styles.sectionLede}>
            Wave, Orange Money, MTN MoMo, Moov, Free Money, Djamo — et MoneyGram, Western Union,
            Wise, Revolut, Interac pour la diaspora. Chaque canal indique ce qu’il demande, ce qu’il
            coûte et le temps qu’il prend. Ils sont regroupés, jamais classés : le bon canal dépend
            entièrement d’où se trouve la personne qui reçoit.
          </p>
          <Card padding="lg" elevation={1} className={styles.panel}>
            <ul className={styles.codes}>
              {CURRENCY_ORDER.map((c) => (
                <li key={c} className={styles.code}>
                  <span className={styles.codeSymbol}>{c}</span>
                  <span className={styles.codeName}>{currencyLabel(c)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className={styles.section} aria-labelledby="securite">
          <h2 id="securite" className={styles.sectionTitle}>
            Ce qui protège l’argent
          </h2>
          <p className={styles.sectionLede}>
            La sécurité qui compte au quotidien n’est pas un logo de coffre-fort : c’est le nombre
            de fois où l’application vous demande de confirmer, et ce qu’elle montre à l’écran quand
            quelqu’un regarde par-dessus votre épaule.
          </p>
          <div className={styles.grid}>
            {SAFEGUARDS.map((s) => (
              <Card key={s.title} padding="lg" elevation={1} className={styles.tile}>
                <span className={styles.tileIcon} aria-hidden="true">
                  <Icon name={s.icon} size={24} />
                </span>
                <h3 className={styles.tileTitle}>{s.title}</h3>
                <p className={styles.tileBody}>{s.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card padding="none" elevation={2} className={styles.cta}>
          <h2 className={styles.ctaTitle}>Essayez sans créer de compte</h2>
          <p className={styles.ctaBody}>
            La démo est complète : un portefeuille, des actions africaines, des transactions qui se
            règlent sous vos yeux, le change et ses marges.
          </p>
          <Button to="/bienvenue" size="lg">
            Explorer la démo
          </Button>
        </Card>
      </main>

      <footer className={styles.footer}>
        {/* The one thing a money product cannot be vague about. */}
        <p className={styles.disclaimer}>
          <strong>Keewal Meere est une démonstration.</strong> L’application ne détient pas d’argent
          réel, n’exécute aucun ordre sur un marché et n’est agréée par aucune autorité. Les prix,
          les taux de change et les frais affichés sont des valeurs de démonstration — les deux
          parités du franc CFA exceptées, qui sont exactes. Rien ici ne constitue un conseil en
          investissement.
        </p>
        <div className={styles.footerBar}>
          <Wordmark size="sm" />
          <Button to="/bienvenue" variant="ghost">
            Ouvrir l’application
          </Button>
        </div>
      </footer>
    </div>
  )
}

/**
 * Données et connexion — where every number on screen comes from.
 *
 * Two readers, one page. For whoever deploys this, it answers "did my key take effect?"
 * without opening a console: the mode, the address, and anything wrong with the
 * configuration. For whoever is using it, it answers the more important question — which
 * of these figures are real.
 *
 * The second is why the page is in the app at all rather than in a README. An application
 * that shows an invented balance is not dishonest; one that shows an invented balance with
 * nowhere to find that out is. Every line below says plainly whether it is a demonstration
 * value, and the two CFA parities are called out as the one thing that is exact either way.
 *
 * **The market rows are read from the back-end, not from the mode.** « Connected » used to
 * be one state for every row, and it stopped being true the day the reference server grew
 * feeds: a deployment can have live coins, a live rate table and the BRVM still on
 * demonstration figures, because no public feed carries Abidjan. `api.market.sources()` is
 * one row per kind — live, demo or failing, with the provider, the time of the last read and
 * what it does and does not cover — and those three rows say exactly that.
 */
import { api, isLive } from '@/api'
import type { MarketSource, MarketSourceKind } from '@/api/types'
import { Badge, Callout, Icon, List, ListRow, PageHeader } from '@/components'
import { env } from '@/config/env'
import { formatRelative } from '@/lib/format'
import type { Locale } from '@/lib/format'
import { QK, useQuery, useSettings } from '@/store'
import { RowIcon } from './RowIcon'
import type { IconName } from '@/components'
import styles from './DataSourcePage.module.css'

interface SourceRow {
  icon: IconName
  title: string
  /** What it is when there is no back-end. */
  demo: string
  /** What it becomes once there is one. */
  connected: string
  /** Rows the back-end reports on individually, through `market.sources()`. */
  kind?: MarketSourceKind
}

const SOURCES: readonly SourceRow[] = [
  {
    icon: 'landmark',
    title: 'Comptes et soldes',
    demo: 'Un jeu de données fixe, identique à chaque ouverture.',
    connected: 'Le grand livre de votre back-end.',
  },
  {
    icon: 'chart-line',
    title: 'Cours des actions',
    kind: 'equity',
    demo: 'Une marche aléatoire autour d’un prix de départ plausible. Aucun rapport avec le marché.',
    connected: 'Le flux de données de marché raccordé au back-end.',
  },
  {
    icon: 'crypto',
    title: 'Cours des cryptomonnaies',
    kind: 'crypto',
    demo: 'Une marche aléatoire autour d’un prix de départ plausible. Aucun rapport avec le marché.',
    connected: 'Le flux de données de marché raccordé au back-end.',
  },
  {
    icon: 'transfer',
    title: 'Taux de change',
    kind: 'fx',
    demo: 'Des taux d’ordre de grandeur réaliste, mais pas une cotation.',
    connected: 'Le fournisseur de taux raccordé au back-end.',
  },
  {
    icon: 'send',
    title: 'Frais et limites des opérateurs',
    demo: 'Des valeurs proches de ce que ces opérateurs facturent, sans être leur tarif.',
    connected: 'Les tarifs que chaque opérateur renvoie.',
  },
  {
    icon: 'file-text',
    title: 'Relevés et feuillets fiscaux',
    demo: 'Des documents listés mais vides : il n’y a rien à déclarer.',
    connected: 'Vos documents réels.',
  },
]

/** One sentence per row: who, when, and what is left out. A demo row with nothing to add
    keeps the row's own description of what a demonstration figure is. */
function describe(s: MarketSource, locale: Locale, fallback: string): string {
  const when = s.updatedAt ? `, mis à jour ${formatRelative(s.updatedAt, { locale })}` : ''
  if (s.status === 'live') return `${s.provider ?? 'Flux raccordé'}${when}. ${s.detail ?? ''}`.trim()
  if (s.status === 'error') return `${s.provider ?? 'Flux'} en échec${when}. ${s.detail ?? 'Les chiffres affichés sont les derniers lus, ou des valeurs de démonstration.'}`.trim()
  return s.detail ?? fallback
}

const STATUS_BADGE: Record<MarketSource['status'], { label: string; tone: 'pos' | 'neutral' | 'neg' }> = {
  live: { label: 'En direct', tone: 'pos' },
  demo: { label: 'Démo', tone: 'neutral' },
  error: { label: 'En échec', tone: 'neg' },
}

export default function DataSourcePage() {
  const { locale } = useSettings()
  const sources = useQuery<MarketSource[]>(QK.marketSources, () => api.market.sources())
  const byKind = (kind: MarketSourceKind) => sources.data?.find((s) => s.kind === kind)

  return (
    <div className={styles.page} data-cascade>
      <PageHeader back="/profil" title="Données et connexion" />
      <p className={styles.intro}>D’où vient chaque chiffre affiché dans l’application.</p>

      <div className={styles.layout}>
        <div className={styles.main}>
          {isLive ? (
            <Callout variant="panel" icon="checkmark-filled" title="Connecté">
              L’application parle à un back-end. Les chiffres affichés viennent de lui ; les trois
              lignes de marché ci-dessous disent, pour chacune, ce qu’il couvre en direct.
            </Callout>
          ) : (
            <Callout variant="panel" title="Mode démonstration">
              Aucun back-end n’est configuré. L’application ne détient pas d’argent réel, n’exécute
              aucun ordre sur un marché et n’est agréée par aucune autorité. Tout ce qui suit est
              une valeur de démonstration.
            </Callout>
          )}

          {env.errors.length > 0 ? (
            <Callout variant="panel" title="Configuration à corriger">
              <ul className={styles.errors}>
                {env.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Callout>
          ) : null}

          <section className={styles.group} aria-labelledby="src">
            <h2 className="t-section" id="src">
              Ce que vous voyez
            </h2>
            <List>
              {SOURCES.map((s) => {
                /* A badge only on the rows the back-end reports on one by one: the three
                   market rows can differ from each other, and the pill is what makes a
                   « Démo » beside two « En direct » findable at a glance. The other rows
                   carry the mode the panel above already states, so they carry no pill. */
                const src = s.kind ? byKind(s.kind) : undefined
                const subtitle = src ? describe(src, locale, s.demo) : isLive ? s.connected : s.demo
                return (
                  <ListRow
                    key={s.title}
                    static
                    wrap
                    leading={<RowIcon name={s.icon} />}
                    title={s.title}
                    subtitle={subtitle}
                    trailing={src ? <Badge tone={STATUS_BADGE[src.status].tone} size="xs">{STATUS_BADGE[src.status].label}</Badge> : undefined}
                  />
                )
              })}
            </List>
            {/* The one number that is exact in both modes, and worth saying so. */}
            <p className={styles.note}>
              <Icon name="info" size={16} className={styles.noteIcon} />
              Une exception dans les deux modes : le franc CFA est arrimé à l’euro à 655.957
              exactement, par traité. Ce n’est pas une cotation, et l’application ne la traite
              jamais comme telle.
            </p>
          </section>

          <section className={styles.group} aria-labelledby="cfg">
            <h2 className="t-section" id="cfg">
              Configuration
            </h2>
            <List>
              <ListRow
                static
                wrap
                stack
                leading={<RowIcon name="link-2" />}
                title="Back-end"
                subtitle={env.apiUrl ?? 'Aucun — VITE_API_URL n’est pas définie'}
              />
              <ListRow static wrap stack leading={<RowIcon name="info" />} title="Version installée" subtitle={env.buildId} />
            </List>
          </section>

          {/* Written where somebody about to paste an Orange Money secret will read it. */}
          <Callout variant="panel" icon="lock-keyhole" title="Où vont les clés">
            Une variable <code className={styles.code}>VITE_</code> est publique : elle est inscrite
            dans le JavaScript livré à chaque visiteur. Seule l’adresse du back-end a sa place ici.
            Les clés de données de marché, de KYC, de Wave, d’Orange Money ou du dépositaire vivent
            sur le serveur, jamais dans cette application.
          </Callout>
        </div>
      </div>
    </div>
  )
}

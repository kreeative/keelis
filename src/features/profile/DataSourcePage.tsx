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
 */
import { isLive } from '@/api'
import { Callout, Icon, List, ListRow, PageHeader } from '@/components'
import { env } from '@/config/env'
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
    title: 'Cours des actifs',
    demo: 'Une marche aléatoire autour d’un prix de départ plausible. Aucun rapport avec le marché.',
    connected: 'Le flux de données de marché raccordé au back-end.',
  },
  {
    icon: 'transfer',
    title: 'Taux de change',
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

export default function DataSourcePage() {
  return (
    <div className={styles.page}>
      <PageHeader back="/profil" title="Données et connexion" />
      <p className={styles.intro}>D’où vient chaque chiffre affiché dans l’application.</p>

      <div className={styles.layout}>
        <div className={styles.main}>
          {isLive ? (
            <Callout variant="panel" icon="checkmark-filled" title="Connecté">
              L’application parle à un back-end. Les chiffres affichés viennent de lui, et plus
              rien n’est simulé.
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
              {SOURCES.map((s) => (
                /* No per-row badge. Every row carries the same state — the app is either
                   connected or it is not — so five identical « DÉMONSTRATION » pills would
                   be repetition that costs each row half its width on a phone. The panel
                   above says the mode once; each row says what its own source is. */
                <ListRow key={s.title} static wrap leading={<RowIcon name={s.icon} />} title={s.title} subtitle={isLive ? s.connected : s.demo} />
              ))}
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

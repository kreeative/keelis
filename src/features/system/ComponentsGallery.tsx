/**
 * Galerie de composants — page de développement, hors AppShell.
 * Chaque composant de src/components y figure dans tous ses états.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  AmountDisplay,
  Avatar,
  Badge,
  Button,
  Card,
  Chart,
  Delta,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Keypad,
  List,
  ListRow,
  ChoiceList,
  Callout,
  StatGrid,
  Money,
  OfflineBanner,
  PageHeader,
  ProgressBar,
  QRCode,
  QuickActions,
  Refreshing,
  SegmentedControl,
  SelectField,
  Sheet,
  Skeleton,
  SkeletonAmount,
  SkeletonRow,
  Sparkline,
  Spinner,
  Switch,
  TextAreaField,
  Wordmark,
} from '@/components'
import { ApiError } from '@/api'
import { ConfirmSheet, SuccessScreen } from '@/features/shared'
import { useSettings, useToast } from '@/store'
import { cn } from '@/lib/cn'
import type { ThemeChoice } from '@/lib/theme'
import styles from './ComponentsGallery.module.css'

const THEME_SEGMENTS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

const SECTIONS: ReadonlyArray<{ id: string; title: string }> = [
  { id: 'couleurs', title: 'Couleurs' },
  { id: 'espacement', title: 'Espacement' },
  { id: 'typographie', title: 'Typographie' },
  { id: 'boutons', title: 'Button' },
  { id: 'montants', title: 'Montants' },
  { id: 'clavier', title: 'Keypad' },
  { id: 'listes', title: 'ListRow et List' },
  { id: 'selection', title: 'ChoiceList et StatGrid' },
  { id: 'segments', title: 'SegmentedControl' },
  { id: 'feuilles', title: 'Sheet et confirmation' },
  { id: 'graphiques', title: 'Chart et Sparkline' },
  { id: 'champs', title: 'Field' },
  { id: 'indicateurs', title: 'Badge, Switch, ProgressBar' },
  { id: 'avertissements', title: 'Callout' },
  { id: 'etats', title: 'États vides, erreurs, toast' },
  { id: 'squelettes', title: 'Skeleton' },
  { id: 'divers', title: 'Avatar, Card, QR, navigation' },
]

/** The kit's spacing scale, grouped as its own « Design application » board groups it. */
const SPACING: ReadonlyArray<{ group: string; steps: Array<[string, number]> }> = [
  { group: 'Petit', steps: [['--sp-1', 4], ['--sp-2', 8], ['--sp-3', 12]] },
  { group: 'Moyen', steps: [['--sp-4', 16], ['--sp-5', 24], ['--sp-6', 32]] },
  { group: 'Grand', steps: [['--sp-7', 48], ['--sp-8', 64], ['--sp-9', 96]] },
]

/** Where each one goes — the kit's second board, the one that made the rhythm consistent. */
const SPACING_USE: ReadonlyArray<{ what: string; small: string; large: string; token: string }> = [
  { what: 'Entre éléments', small: '4, 8', large: '4, 8', token: '--space-elements' },
  { what: 'Entre lignes de liste', small: '16', large: '16', token: '--space-items' },
  { what: 'Titre de section → contenu', small: '16', large: '24', token: '--space-block' },
  { what: 'Entre sections', small: '40', large: '48', token: '--space-section' },
  { what: 'Marge au bord de l’écran', small: '16', large: 'flex', token: '--gutter' },
]

const TOKENS: ReadonlyArray<{ name: string }> = [
  { name: '--ink-900' },
  { name: '--ink-600' },
  { name: '--ink-400' },
  { name: '--ink-300' },
  { name: '--line' },
  { name: '--surface' },
  { name: '--surface-alt' },
  { name: '--accent' },
  { name: '--accent-soft' },
  { name: '--accent-text' },
  { name: '--on-accent' },
  { name: '--pos' },
  { name: '--neg' },
  { name: '--warn' },
]

const TYPE_SPECS: ReadonlyArray<{ cls: string; label: string; spec: string }> = [
  { cls: 't-display', label: '1 428,50', spec: '.t-display · 48 px → 64 px ≥768' },
  { cls: 't-h1', label: 'Titre de page', spec: '.t-h1 · 30 px → 38 px ≥768' },
  { cls: 't-h2', label: 'Titre de section', spec: '.t-h2 · 22 px → 26 px ≥768' },
  { cls: 't-body', label: 'Texte courant de l’interface', spec: '.t-body · 16 px' },
  { cls: 't-small', label: 'Texte secondaire et sous-titres', spec: '.t-small · 14 px' },
  { cls: 't-label', label: 'Étiquette de section', spec: '.t-label · 12 px, majuscules' },
]

const BASE_T = Date.UTC(2026, 0, 1)
const SERIES_UP = Array.from({ length: 60 }, (_, i) => ({ t: BASE_T + i * 3_600_000, p: 100 + Math.sin(i / 7) * 5 + i * 0.55 }))
const SERIES_DOWN = Array.from({ length: 60 }, (_, i) => ({ t: BASE_T + i * 3_600_000, p: 140 - Math.sin(i / 6) * 4 - i * 0.5 }))
const SERIES_FLAT = Array.from({ length: 60 }, (_, i) => ({ t: BASE_T + i * 3_600_000, p: 120 + Math.sin(i / 4) * 1.5 }))
const SPARK_UP = SERIES_UP.filter((_, i) => i % 3 === 0).map((p) => p.p)
const SPARK_DOWN = SERIES_DOWN.filter((_, i) => i % 3 === 0).map((p) => p.p)

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 className="t-label" id={`${id}-title`}>
        {title}
      </h2>
      <div className={styles.grid}>{children}</div>
    </section>
  )
}

function Example({ caption, children, wide = false, fill = false }: { caption: string; children: ReactNode; wide?: boolean; fill?: boolean }) {
  return (
    <div className={cn(styles.example, wide && styles.wide)}>
      <p className={styles.caption}>{caption}</p>
      <div className={cn(styles.demo, fill && styles.demoFill)}>{children}</div>
    </div>
  )
}

export default function ComponentsGallery() {
  const { theme, setTheme, hidden, toggleHidden } = useSettings()
  const { toast } = useToast()

  const [pad, setPad] = useState('125,40')
  const [pin, setPin] = useState('12')
  const [seg2, setSeg2] = useState('a')
  const [seg3, setSeg3] = useState('m')
  const [seg4, setSeg4] = useState('1j')
  const [on, setOn] = useState(true)
  const [choice, setChoice] = useState('interac')
  const [off, setOff] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [pinSheet, setPinSheet] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [success, setSuccess] = useState(true)
  const [text, setText] = useState('Aïssatou Ndiaye')

  const demoError = useMemo(() => new ApiError('Le service de prix ne répond pas.', 'network'), [])

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brand}>
            <Wordmark size="sm" />
            <h1 className="t-h1">Composants</h1>
          </div>
          <div className={styles.themeControl}>
            <SegmentedControl segments={THEME_SEGMENTS} value={theme} onChange={setTheme} label="Thème" size="sm" />
          </div>
        </div>
      </header>

      <div className={styles.page}>
        <nav className={styles.toc} aria-label="Sommaire">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>
              {s.title}
            </a>
          ))}
        </nav>

        <Section id="couleurs" title="Couleurs">
          <div className={styles.swatches}>
            {TOKENS.map((t) => (
              <div key={t.name} className={styles.swatchItem}>
                <span className={styles.swatch} style={{ background: `var(${t.name})` }} aria-hidden="true" />
                <span className={styles.mono}>{t.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="espacement" title="Espacement">
          <Example caption="L’échelle, groupée comme la planche « Design application » du kit" wide>
            <div className={styles.spacingGroups}>
              {SPACING.map((g) => (
                <div key={g.group} className={styles.spacingGroup}>
                  <p className="t-label">{g.group}</p>
                  {g.steps.map(([name, px]) => (
                    <div key={name} className={styles.spacingRow}>
                      <span className={styles.mono}>{name}</span>
                      <span className={`t-small ${styles.spacingPx}`}>{px} px</span>
                      <span className={styles.spacingBar} style={{ width: `var(${name})` }} aria-hidden="true" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Example>
          <Example caption="Où chaque valeur va. Seules les deux mesures de section grandissent, au point de rupture 1024 px du kit." wide>
            <div className={styles.useTable} role="table" aria-label="Application de l’échelle d’espacement">
              <div className={styles.useHead} role="row">
                <span role="columnheader">Espace entre</span>
                <span role="columnheader">≤ 1023</span>
                <span role="columnheader">≥ 1024</span>
                <span role="columnheader">Jeton</span>
              </div>
              {SPACING_USE.map((r) => (
                <div key={r.what} className={styles.useRow} role="row">
                  <span role="cell">{r.what}</span>
                  <span className="num" role="cell">
                    {r.small}
                  </span>
                  <span className="num" role="cell">
                    {r.large}
                  </span>
                  <span className={styles.mono} role="cell">
                    {r.token}
                  </span>
                </div>
              ))}
            </div>
          </Example>
        </Section>

        <Section id="typographie" title="Typographie">
          {TYPE_SPECS.map((t) => (
            <Example key={t.cls} caption={t.spec} wide>
              <p className={t.cls}>{t.label}</p>
            </Example>
          ))}
        </Section>

        <Section id="boutons" title="Button">
          <Example caption="primary · md et lg">
            <div className={styles.stack}>
              <Button>Confirmer</Button>
              <Button size="lg">Confirmer</Button>
            </div>
          </Example>
          <Example caption="secondary · md et lg">
            <div className={styles.stack}>
              <Button variant="secondary">Modifier</Button>
              <Button variant="secondary" size="lg">
                Modifier
              </Button>
            </div>
          </Example>
          <Example caption="ghost · md et lg">
            <div className={styles.stack}>
              <Button variant="ghost">Tout voir</Button>
              <Button variant="ghost" size="lg">
                Tout voir
              </Button>
            </div>
          </Example>
          <Example caption="destructive · md et lg">
            <div className={styles.stack}>
              <Button variant="destructive">Supprimer</Button>
              <Button variant="destructive" size="lg">
                Supprimer
              </Button>
            </div>
          </Example>
          <Example caption="désactivé">
            <div className={styles.stack}>
              <Button disabled>Confirmer</Button>
              <Button variant="secondary" disabled>
                Modifier
              </Button>
              <Button variant="ghost" disabled>
                Tout voir
              </Button>
            </div>
          </Example>
          <Example caption="chargement (largeur figée)">
            <div className={styles.stack}>
              <Button loading>Confirmer</Button>
              <Button variant="secondary" loading size="lg">
                Modifier
              </Button>
            </div>
          </Example>
          <Example caption="avec icône et icône seule">
            <div className={styles.row}>
              <Button icon={<Icon name="plus" size={18} />}>Ajouter</Button>
              <Button variant="secondary" iconOnly aria-label="Filtrer">
                <Icon name="filter" />
              </Button>
              <Button variant="ghost" iconOnly aria-label="Fermer">
                <Icon name="x" />
              </Button>
            </div>
          </Example>
          <Example caption="block · pleine largeur" wide>
            <Button block size="lg">
              Acheter pour 125,40 $
            </Button>
          </Example>
        </Section>

        <Section id="montants" title="Montants">
          <Example caption="AmountDisplay · display avec delta positif" wide>
            <AmountDisplay value={12428.5} delta={148.2} deltaPct={1.21} period="24 h" />
          </Example>
          <Example caption="AmountDisplay · h1 avec delta négatif">
            <AmountDisplay value={3567.5} delta={-42.15} deltaPct={-1.17} period="24 h" size="h1" />
          </Example>
          <Example caption="AmountDisplay · delta nul et légende">
            <AmountDisplay value={500} delta={0} deltaPct={0} period="24 h" caption="Depuis l’ouverture" size="h1" />
          </Example>
          <Example caption="AmountDisplay · unité non fiat (currency BTC)">
            <AmountDisplay value={1.2508} currency="BTC" size="h1" />
          </Example>
          <Example caption="AmountDisplay · chargement" fill>
            <AmountDisplay value={undefined} loading />
          </Example>
          <Example caption="Money · standard, signé, coloré">
            <div className={styles.stack}>
              <Money value={1234.56} />
              <Money value={1234.56} signed tone />
              <Money value={-89.9} tone />
              <Money value={4200} compactCents />
            </div>
          </Example>
          <Example caption="Delta · hausse, baisse, stable">
            <div className={styles.stack}>
              <Delta value={1.42} suffix="24 h" />
              <Delta value={-3.17} suffix="24 h" />
              <Delta value={0} />
            </div>
          </Example>
          <Example caption="masquage des soldes (réglage global)">
            <div className={styles.row}>
              <Switch checked={hidden} onChange={toggleHidden} label="Masquer les soldes" />
              <span className="t-small t-muted">{hidden ? 'Masqué' : 'Affiché'}</span>
            </div>
          </Example>
        </Section>

        <Section id="clavier" title="Keypad">
          <Example caption="Keypad · montant, 2 décimales" wide>
            <div className={styles.padDemo}>
              <p className="t-h2 num">{pad || '0'} $</p>
              <Keypad value={pad} onChange={setPad} />
            </div>
          </Example>
          <Example caption="Keypad · integerOnly, 4 chiffres (NIP), dans une feuille" wide>
            <div className={styles.stack}>
              <Button variant="secondary" onClick={() => setPinSheet(true)}>
                Ouvrir le clavier NIP
              </Button>
              <p className="t-small t-faint">Saisie en cours : {pin || '—'}</p>
            </div>
          </Example>
        </Section>

        <Section id="listes" title="ListRow et List">
          <Example caption="List · titre, sous-titre, valeur, valeur secondaire" wide>
            <List>
              <ListRow title="Épicerie Jean-Talon" subtitle="Carte ···· 7364 · 14:32" value={<Money value={-42.18} />} valueSub="Réglée" />
              <ListRow leading={<Avatar label="Amina Diallo" />} title="Amina Diallo" subtitle="e-Transfer · 09:12" value={<Money value={120} signed tone />} />
              <ListRow leading={<Avatar label="Bitcoin" monogram="BTC" tone="accent" />} title="Bitcoin" subtitle="0,0428 BTC" value={<Money value={6042.11} />} valueSub={<Delta value={1.4} />} />
            </List>
          </Example>
          <Example caption="List · chevron, lien, interrupteur, statique, atténuée" wide>
            <List>
              <ListRow to="/composants" title="Ligne lien" subtitle="Navigue avec react-router" chevron />
              <ListRow onClick={() => toast('Ligne cliquée')} title="Ligne bouton" subtitle="Déclenche une action" chevron />
              <ListRow title="Ligne avec interrupteur" subtitle="Le contrôle remplace le chevron" trailing={<Switch checked={on} onChange={setOn} label="Exemple" />} />
              <ListRow static title="Ligne statique" subtitle="Aucune interaction" value="—" />
              <ListRow muted title="Ligne atténuée" subtitle="En attente de règlement" value={<Money value={-18.4} />} valueSub={<Badge tone="neutral">En attente</Badge>} />
            </List>
          </Example>
          <Example caption="List · stack — sous 768 px la valeur passe sous le texte au lieu de le comprimer" wide>
            <List>
              <ListRow
                stack
                leading={<Avatar label="Bitcoin" monogram="BTC" tone="accent" />}
                title="Compte d’épargne à intérêt élevé"
                subtitle="Non enregistré · Géré"
                value={<Money value={9012345.67} />}
                valueSub="CAD"
                chevron
              />
            </List>
          </Example>
        </Section>

        <Section id="selection" title="ChoiceList et StatGrid">
          <Example caption="ChoiceList · un radiogroup complet : flèches, Home/Fin, un seul arrêt de tabulation" wide>
            <ChoiceList
              label="Provenance des fonds"
              value={choice}
              onChange={setChoice}
              options={[
                { value: 'interac', title: 'Virement Interac', subtitle: 'Instantané · jusqu’à 3 000 $', leading: <Avatar label="Interac" monogram="IN" /> },
                { value: 'compte', title: 'Compte bancaire ···· 4394', subtitle: 'Dernier dépôt : 50,00 $ le 10 janvier', leading: <Avatar label="Banque" monogram="BQ" /> },
                { value: 'carte', title: 'Carte de débit ···· 8888', subtitle: 'Frais de 1,5 % · immédiat', leading: <Avatar label="Carte" monogram="CA" /> },
                { value: 'cheque', title: 'Dépôt de chèque', subtitle: 'Indisponible pour ce compte', leading: <Avatar label="Chèque" monogram="CH" />, disabled: true },
              ]}
              footer={
                <Button variant="ghost" icon={<Icon name="plus" size={18} />}>
                  Ajouter une source
                </Button>
              }
            />
          </Example>
          <Example caption="StatGrid · lignes étiquette/valeur sous 768 px, grille étiquette-au-dessus au-delà" wide>
            <StatGrid
              label="Données de marché"
              stats={[
                { label: 'Capitalisation', value: '1 342 G$' },
                { label: 'Volume 24 h', value: '28,4 G$' },
                { label: 'Sommet 52 sem.', value: '73 750,00 $' },
                { label: 'Creux 52 sem.', value: '24 900,00 $' },
                { label: 'Offre en circulation', value: '19,8 M BTC' },
                { label: 'Réseaux', value: 'Bitcoin, Lightning' },
              ]}
            />
          </Example>
        </Section>

        <Section id="segments" title="SegmentedControl">
          <Example caption="2 segments · md">
            <SegmentedControl segments={[{ value: 'a', label: 'Acheter' }, { value: 'v', label: 'Vendre' }]} value={seg2} onChange={setSeg2} label="Sens" />
          </Example>
          <Example caption="3 segments · sm">
            <SegmentedControl segments={[{ value: 's', label: 'Système' }, { value: 'c', label: 'Clair' }, { value: 'm', label: 'Sombre' }]} value={seg3} onChange={setSeg3} label="Thème d’exemple" size="sm" />
          </Example>
          <Example caption="4 segments · sm">
            <SegmentedControl
              segments={[{ value: '1j', label: '1J' }, { value: '1s', label: '1S' }, { value: '1m', label: '1M' }, { value: '1a', label: '1A' }]}
              value={seg4}
              onChange={setSeg4}
              label="Période"
              size="sm"
            />
          </Example>
          <Example caption="block · pleine largeur" wide>
            <SegmentedControl segments={[{ value: 'a', label: 'Chèque' }, { value: 'v', label: 'Épargne' }]} value={seg2} onChange={setSeg2} label="Compte" block />
          </Example>
        </Section>

        <Section id="feuilles" title="Sheet et confirmation">
          <Example caption="Sheet · feuille simple avec pied">
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Ouvrir une feuille
            </Button>
          </Example>
          <Example caption="ConfirmSheet · montant, frais, écart, total">
            <Button variant="secondary" onClick={() => setConfirm(true)}>
              Ouvrir la confirmation
            </Button>
          </Example>
          <Example caption="SuccessScreen · rendu ici dans un cadre de démonstration" wide>
            {success ? (
              <div className={styles.frame}>
                <SuccessScreen
                  title="Achat confirmé"
                  hero={<Money value={125.4} unmasked />}
                  caption="0,00088 BTC ajoutés à votre portefeuille"
                  status="En attente · quelques minutes"
                  details={[
                    { label: 'Prix d’exécution', value: <Money value={142350} /> },
                    { label: 'Écart', value: <Money value={1.88} /> },
                    { label: 'Total débité', value: <Money value={125.4} /> },
                  ]}
                  primaryLabel="Terminé"
                  onPrimary={() => setSuccess(false)}
                  secondaryLabel="Voir la transaction"
                  onSecondary={() => toast('Navigation de démonstration')}
                />
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setSuccess(true)}>
                Réafficher l’état de succès
              </Button>
            )}
          </Example>
        </Section>

        <Section id="graphiques" title="Chart et Sparkline">
          <Example caption="Chart · 60 points, tendance positive" wide>
            <Chart points={SERIES_UP} height={140} tone="pos" label="Série de démonstration en hausse" />
          </Example>
          <Example caption="Chart · tendance négative" wide>
            <Chart points={SERIES_DOWN} height={140} tone="neg" label="Série de démonstration en baisse" />
          </Example>
          <Example caption="Chart · neutre (ink)" wide>
            <Chart points={SERIES_FLAT} height={140} tone="ink" label="Série de démonstration stable" />
          </Example>
          <Example caption="Chart · chargement" wide>
            <Chart points={[]} height={140} loading label="Chargement" />
          </Example>
          <Example caption="Sparkline · hausse et baisse">
            <div className={styles.row}>
              <Sparkline values={SPARK_UP} />
              <Sparkline values={SPARK_DOWN} />
              <Sparkline values={SPARK_UP} tone="ink" />
            </div>
          </Example>
        </Section>

        <Section id="champs" title="Field">
          <Example caption="Field · vide avec indice" fill>
            <Field label="Courriel" placeholder="nom@exemple.ca" hint="Nous confirmons chaque connexion." />
          </Example>
          <Example caption="Field · rempli" fill>
            <Field label="Nom du bénéficiaire" value={text} onChange={(e) => setText(e.target.value)} />
          </Example>
          <Example caption="Field · erreur" fill>
            <Field label="Montant" value="0" readOnly error="Le montant doit être supérieur à 0 $." />
          </Example>
          <Example caption="Field · succès — l’icône, pas la teinte, distingue le message" fill>
            <Field label="Adresse Bitcoin" value="bc1q…f4k2" readOnly success="Adresse valide sur le réseau Bitcoin." />
          </Example>
          <Example caption="Field · désactivé" fill>
            <Field label="Numéro de compte" value="4001 8827 3" disabled readOnly />
          </Example>
          <Example caption="Field · ornements avant et après" fill>
            <Field label="Recherche" placeholder="Rechercher" leading={<Icon name="search" size={20} />} trailing={<span className="t-small t-faint">CAD</span>} />
          </Example>
          <Example caption="SelectField" fill>
            <SelectField label="Réseau" defaultValue="btc">
              <option value="btc">Bitcoin</option>
              <option value="ltn">Lightning</option>
            </SelectField>
          </Example>
          <Example caption="TextAreaField" wide fill>
            <TextAreaField label="Note" placeholder="Ajouter une note au virement" />
          </Example>
        </Section>

        <Section id="indicateurs" title="Badge, Switch, ProgressBar">
          <Example caption="Badge · toutes les tonalités" wide>
            <div className={styles.row}>
              <Badge>Vérifié</Badge>
              <Badge tone="neutral">En attente</Badge>
              <Badge tone="pos">+1,4 %</Badge>
              <Badge tone="neg">Échouée</Badge>
              <Badge tone="warn">Gelée</Badge>
              <Badge icon={<Icon name="shield-check" />}>Avec icône</Badge>
            </div>
          </Example>
          <Example caption="Badge · icône de tonalité (icon) — la forme porte le statut, la teinte ne le peut pas" wide>
            <div className={styles.row}>
              <Badge icon>Vérifié</Badge>
              <Badge tone="neutral" icon>
                En attente
              </Badge>
              <Badge tone="pos" icon>
                Réglée
              </Badge>
              <Badge tone="neg" icon>
                Échouée
              </Badge>
              <Badge tone="warn" icon>
                Gelée
              </Badge>
            </div>
          </Example>
          <Example caption="Badge · taille xs, texte seul" wide>
            <div className={styles.row}>
              <Badge size="xs">Nouveau</Badge>
              <Badge size="xs" tone="neutral">
                En attente
              </Badge>
              <Badge size="xs" tone="neg">
                Échouée
              </Badge>
            </div>
          </Example>
          <Example caption="Switch · activé, désactivé, inactif, en cours">
            <div className={styles.row}>
              <Switch checked={on} onChange={setOn} label="Activé" />
              <Switch checked={off} onChange={setOff} label="Désactivé" />
              <Switch checked disabled onChange={() => {}} label="Inactif" />
              <Switch checked={false} loading onChange={() => {}} label="En cours" />
            </div>
          </Example>
          <Example caption="ProgressBar · thin à 0, 53 et 100 %" wide>
            <div className={styles.stackWide}>
              <ProgressBar value={0} label="Progression 0 %" />
              <ProgressBar value={0.53} label="Progression 53 %" />
              <ProgressBar value={1} label="Progression 100 %" />
            </div>
          </Example>
          <Example caption="ProgressBar · regular, tonalité ink" wide>
            <div className={styles.stackWide}>
              <ProgressBar value={0.53} size="regular" label="Progression 53 %" />
              <ProgressBar value={0.53} size="regular" tone="ink" label="Progression 53 %" />
            </div>
          </Example>
          <Example caption="Spinner · 20 px et 28 px">
            <div className={styles.row}>
              <Spinner />
              <Spinner size={28} />
              <Refreshing active />
            </div>
          </Example>
        </Section>

        <Section id="avertissements" title="Callout">
          <Example caption="Callout · note en ligne, avant l’action et non après" wide>
            <Callout icon="circle-alert">Les envois sont irréversibles. Vérifiez l’adresse et le réseau avant de confirmer.</Callout>
          </Example>
          <Example caption="Callout · encadré, pour une conséquence qui mérite qu’on s’arrête" wide>
            <Callout variant="panel" title="Un retrait d’Épargne interrompt les intérêts">
              Les intérêts sont calculés sur le solde quotidien. Un retrait aujourd’hui réduit le versement du mois en cours.
            </Callout>
          </Example>
        </Section>

        <Section id="etats" title="États vides, erreurs, toast">
          <Example caption="EmptyState · complet" wide>
            <EmptyState message="Aucune transaction pour l’instant." placeholderCaption="Espace réservé au visuel" action={<Button variant="secondary">Ajouter des fonds</Button>} />
          </Example>
          <Example caption="EmptyState · compact" wide>
            <EmptyState compact message="Aucun résultat pour cette recherche." />
          </Example>
          <Example caption="ErrorState · complet avec Réessayer" wide>
            <ErrorState error={demoError} onRetry={() => toast('Nouvelle tentative')} />
          </Example>
          <Example caption="ErrorState · compact" wide>
            <ErrorState compact error={demoError} onRetry={() => toast('Nouvelle tentative')} />
          </Example>
          <Example caption="OfflineBanner · visible uniquement hors ligne" wide>
            <OfflineBanner />
            <p className="t-small t-faint">Le bandeau ne s’affiche que lorsque le navigateur est hors ligne ; il est monté en permanence dans AppShell.</p>
          </Example>
          <Example caption="Toast · une ligne, 3 s">
            <div className={styles.row}>
              <Button variant="secondary" onClick={() => toast('Préférences enregistrées')}>
                Toast neutre
              </Button>
              <Button variant="secondary" onClick={() => toast('Enregistrement impossible.', 'error')}>
                Toast d’erreur
              </Button>
            </div>
          </Example>
        </Section>

        <Section id="squelettes" title="Skeleton">
          <Example caption="Skeleton · text, circle, pill, card">
            <div className={styles.stackWide}>
              <Skeleton width="80%" />
              <div className={styles.row}>
                <Skeleton shape="circle" width={40} height={40} />
                <Skeleton shape="pill" width={96} height={24} />
              </div>
              <Skeleton shape="card" height={72} />
            </div>
          </Example>
          <Example caption="SkeletonRow · trois lignes de liste" wide>
            <SkeletonRow count={3} />
          </Example>
          <Example caption="SkeletonAmount · montant héros" fill>
            <SkeletonAmount />
          </Example>
        </Section>

        <Section id="divers" title="Avatar, Card, QR, navigation">
          <Example caption="Avatar · tonalités et tailles">
            <div className={styles.row}>
              <Avatar label="Aïssatou Ndiaye" />
              <Avatar label="Bitcoin" monogram="BTC" tone="accent" />
              <Avatar label="Kaalis" tone="ink" />
              <Avatar label="Aïssatou Ndiaye" size={56} tone="accent" />
            </div>
          </Example>
          <Example caption="Card · md, lg et cliquable" wide>
            <div className={styles.stackWide}>
              <Card>
                <p className="t-small t-muted">Card padding md</p>
              </Card>
              <Card padding="lg">
                <p className="t-small t-muted">Card padding lg</p>
              </Card>
              <Card to="/composants">
                <p className="t-small t-muted">Card cliquable (lien)</p>
              </Card>
            </div>
          </Example>
          <Example caption="QRCode · 160 px">
            <QRCode value="bitcoin:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" size={160} label="Adresse de démonstration" />
          </Example>
          <Example caption="QuickActions · trois actions" wide>
            <QuickActions
              actions={[
                { label: 'Ajouter des fonds', icon: <Icon name="plus" />, onClick: () => toast('Action de démonstration') },
                { label: 'Envoyer', icon: <Icon name="send" />, onClick: () => toast('Action de démonstration') },
                { label: 'Acheter crypto', icon: <Icon name="chart-line" />, onClick: () => toast('Action de démonstration') },
              ]}
            />
          </Example>
          <Example caption="PageHeader · retour, titre et action" wide>
            <PageHeader
              back={-1}
              eyebrow="Compte chèque"
              title="Détails du compte"
              actions={
                <Button variant="ghost" iconOnly aria-label="Options">
                  <Icon name="more-horizontal" />
                </Button>
              }
            />
          </Example>
          <Example caption="Wordmark · sm, md, lg et glyphe seul">
            <div className={styles.stack}>
              <Wordmark size="sm" />
              <Wordmark />
              <Wordmark size="lg" />
              <Wordmark glyphOnly />
            </div>
          </Example>
          <Example caption="NavBar" wide>
            <p className="t-small t-muted">
              NavBar est en position fixe (barre de 5 onglets sous 768 px, rail de 72 px au-delà) et n’est pas montée ici : elle vit dans AppShell et entrerait en conflit avec cette page.
            </p>
          </Example>
        </Section>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Feuille de démonstration"
        footer={
          <>
            <Button size="lg" block onClick={() => setSheet(false)}>
              Confirmer
            </Button>
            <Button variant="ghost" block onClick={() => setSheet(false)}>
              Annuler
            </Button>
          </>
        }
      >
        <p className="t-body t-muted">Poignée de 36 × 4, coins supérieurs de 20 px, fond assombri, ombre réservée à ce composant. Le focus est piégé et Échap referme.</p>
      </Sheet>

      <Sheet
        open={pinSheet}
        onClose={() => setPinSheet(false)}
        title="Clavier NIP"
        footer={
          <Button variant="ghost" block onClick={() => setPinSheet(false)}>
            Fermer
          </Button>
        }
      >
        <div className={styles.padSheet}>
          <p className="t-small t-muted">Variante integerOnly : pas de séparateur décimal, quatre chiffres au maximum.</p>
          <p className="t-h2 num">{pin || '—'}</p>
          <Keypad value={pin} onChange={setPin} integerOnly maxLength={4} />
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirmer l’achat"
        hero={<Money value={125.4} unmasked />}
        heroCaption="0,00088 BTC"
        lines={[
          { label: 'Montant', value: <Money value={125.4} /> },
          { label: 'Écart', hint: '1,5 % du prix du marché', value: <Money value={1.88} /> },
          { label: 'Frais', value: <Money value={0} /> },
          { label: 'Total débité', value: <Money value={127.28} />, strong: true },
        ]}
        note="Le prix est garanti pendant 30 secondes."
        confirmLabel="Confirmer l’achat"
        onConfirm={() => {
          setConfirm(false)
          toast('Achat de démonstration confirmé')
        }}
      />

    </div>
  )
}

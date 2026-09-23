/**
 * The lessons — Keewal Meere Learn's own content.
 *
 * The roadmap asks for « pédagogie contextuelle », and the reason is specific to this
 * product: most people buying their first share on the BRVM have never bought one anywhere,
 * and the words on the screen — introduction en bourse, cours, écart — are the part that
 * stops them, not the buttons.
 *
 * Each lesson is four points of two or three sentences and ends by saying what to *do*,
 * including « rien pour l'instant » when that is the honest answer. The first two were
 * written for the market screen and opened from there; the rest exist because the owner
 * gave Learn its own tab, and a tab with two lessons on it is a tab that says the app ran
 * out of things to teach. They are content, not data, which is why they live in the code
 * beside the screens that show them rather than behind the API — a lesson does not change
 * between two visits, and a back-end that had to serve one would only be serving a string.
 */
export type LearnTopic = 'ipo' | 'cours' | 'epargne' | 'repartir' | 'change' | 'crypto'

export interface Lesson {
  title: string
  /** One line under the title in the list — what the lesson is for, not what it contains. */
  lede: string
  points: ReadonlyArray<{ heading: string; body: string }>
  /** What to do now — often nothing, and saying so is the point. */
  closing: string
}

export const LESSONS: Readonly<Record<LearnTopic, Lesson>> = {
  epargne: {
    title: 'Épargner avant d’investir',
    lede: 'Pourquoi le compte Épargne passe avant le premier achat d’action.',
    points: [
      {
        heading: 'Un placement se garde, une épargne se prend',
        body: 'Une action ou une crypto vaut ce que le marché en dit le jour où vous en avez besoin — et ce jour-là, le marché peut être bas. L’épargne, elle, vaut ce que vous y avez mis, plus les intérêts.',
      },
      {
        heading: 'Trois mois de dépenses, d’abord',
        body: 'La règle est simple à compter : ce que vous dépensez en un mois, fois trois, sur le compte Épargne. C’est la somme qui fait qu’un loyer en retard ou une facture d’hôpital ne vous oblige pas à vendre au mauvais moment.',
      },
      {
        heading: 'Le taux est simple, pas composé',
        body: 'Le compte paie 4,00 % par an, calculés chaque jour sur le solde et versés le premier du mois. Ce n’est pas un rendement qui s’emballe ; c’est un revenu régulier sur de l’argent qui reste disponible.',
      },
      {
        heading: 'Un objectif rend l’épargne visible',
        body: 'Un objectif réserve une part du compte pour un projet et calcule la date où vous y serez au rythme actuel. Ce qui est nommé se garde mieux que ce qui traîne sur un solde.',
      },
    ],
    closing: 'Si vos trois mois ne sont pas là, c’est la première chose à faire. Le marché sera encore là après.',
  },
  repartir: {
    title: 'Répartir plutôt que parier',
    lede: 'Ce que la diversification protège, et ce qu’elle ne protège pas.',
    points: [
      {
        heading: 'Une seule ligne, c’est un pari',
        body: 'Tout mettre sur Sonatel, c’est parier que rien n’arrivera à Sonatel — une grève, une taxe, un concurrent. Répartir sur plusieurs entreprises, c’est accepter de gagner un peu moins sur la meilleure pour ne pas tout perdre sur la pire.',
      },
      {
        heading: 'Plusieurs secteurs, pas plusieurs noms',
        body: 'Cinq banques ne font pas une répartition : elles montent et descendent ensemble. Une banque, un cimentier, un opérateur, un brasseur — ce sont des cycles différents, et c’est ce qui compte.',
      },
      {
        heading: 'La crypto compte comme une ligne, pas comme un secteur',
        body: 'Bitcoin, Ethereum et Solana bougent largement ensemble. Les tenir tous les trois n’est pas plus réparti que d’en tenir un ; c’est la part de crypto dans l’ensemble qui décide du risque.',
      },
      {
        heading: 'Ce que la répartition ne fait pas',
        body: 'Elle ne protège pas d’une baisse générale du marché. Quand tout baisse, tout baisse. Elle protège de la faillite d’une seule entreprise, et c’est déjà l’essentiel.',
      },
    ],
    closing: 'Regardez la ligne la plus grosse de votre portefeuille. Si elle fait plus du tiers, la prochaine mise va ailleurs.',
  },
  change: {
    title: 'Le change, et ce qu’il coûte',
    lede: 'Lire un taux, voir la marge, et savoir quand le franc CFA ne bouge pas.',
    points: [
      {
        heading: 'Le franc CFA est arrimé, pas coté',
        body: 'Un euro vaut exactement 655,957 F CFA, par traité, depuis 1999. Ce taux ne bouge pas. Ce qui change entre deux bureaux, c’est la marge que chacun prend dessus.',
      },
      {
        heading: 'La marge est dans l’écart entre deux taux',
        body: 'Le taux « du marché » est le milieu. Vous achetez un peu au-dessus et vendez un peu en dessous, et la différence est le coût. L’application l’affiche en francs avant que vous confirmiez ; un bureau qui ne l’affiche pas la prend quand même.',
      },
      {
        heading: 'Lisez le taux dans le sens qui parle',
        body: 'Un euro à 655,96 F CFA contre 663,92 F CFA, la marge se voit. Un franc à 0,0015 € contre 0,0015 €, elle disparaît dans l’arrondi. Même marge, deux façons de l’écrire.',
      },
      {
        heading: 'Deux conversions coûtent deux marges',
        body: 'Passer du naira au franc CFA par l’euro, c’est payer la marge deux fois. Quand une paire directe existe, elle est moins chère ; l’application choisit la moins chère et vous la montre.',
      },
    ],
    closing: 'Avant de convertir, regardez la ligne « Frais ». Si vous ne la voyez pas, ce n’est pas qu’elle n’existe pas.',
  },
  crypto: {
    title: 'La crypto, sans les promesses',
    lede: 'Ce qu’un bitcoin est, ce qu’il n’est pas, et pourquoi un envoi ne se rappelle pas.',
    points: [
      {
        heading: 'Une crypto n’est adossée à rien',
        body: 'Une action est une part d’une entreprise qui gagne de l’argent. Un bitcoin n’est une part de rien : son prix est ce que le prochain acheteur accepte de payer. C’est ce qui le fait monter vite, et descendre aussi vite.',
      },
      {
        heading: 'La volatilité n’est pas un défaut, c’est la nature du produit',
        body: 'Une baisse de 20 % en une semaine n’est pas un accident sur ce marché ; c’est un mardi. Ne mettez en crypto que l’argent dont la perte ne changerait rien à votre mois.',
      },
      {
        heading: 'Un envoi est définitif',
        body: 'Une fois diffusée sur le réseau, une transaction ne se rappelle pas, et personne — ni nous, ni le réseau — ne peut la renverser. L’adresse et le réseau sont affichés une dernière fois avant la confirmation, et c’est le moment de les lire.',
      },
      {
        heading: 'Le rendement promis est le premier signal d’alarme',
        body: 'Personne ne peut garantir 10 % par mois. Une offre qui le fait est une arnaque, quel que soit le logo, et les victimes sont d’abord celles à qui on avait dit que c’était sans risque.',
      },
    ],
    closing: 'Si vous en achetez, achetez une somme que vous pouvez regarder baisser de moitié sans vendre. Sinon, l’Épargne et les actions font le travail.',
  },
  ipo: {
    title: 'Comprendre une introduction en bourse',
    lede: 'Ce qui se passe quand une entreprise entre en bourse, et pourquoi être premier n’est pas un avantage.',
    points: [
      {
        heading: 'Une entreprise vend une part d’elle-même',
        body: 'Jusque-là elle appartenait à quelques personnes. En entrant en bourse, elle met une partie de son capital en vente, et l’argent récolté sert à la financer — une raffinerie, un réseau, une usine.',
      },
      {
        heading: 'Le premier prix est fixé, pas découvert',
        body: 'Avant l’ouverture, un prix d’introduction est arrêté à l’avance. C’est le seul moment où le prix ne vient pas du marché. Dès la première séance, l’offre et la demande décident, et le cours peut s’en écarter dans les deux sens.',
      },
      {
        heading: 'Être premier n’est pas un avantage',
        body: 'Une action achetée le jour de l’introduction n’a pas de meilleur prix qu’une action achetée six mois plus tard : elle a seulement moins d’historique à regarder. L’empressement est la seule chose que l’événement crée.',
      },
      {
        heading: 'Ce qu’il y a à lire d’ici là',
        body: 'Le prospectus dit ce que l’entreprise gagne, ce qu’elle doit, et ce qu’elle compte faire de l’argent. C’est un document public, et c’est le seul qui engage l’entreprise.',
      },
    ],
    closing: 'Rien à faire pour l’instant. Le titre apparaîtra dans la liste le jour de son introduction, et vous pourrez l’acheter comme les autres.',
  },
  cours: {
    title: 'Comment lire un cours',
    lede: 'Le prix, la variation, le pourcentage et l’écart — quatre chiffres, quatre pièges.',
    points: [
      {
        heading: 'Le prix est celui de la dernière transaction',
        body: 'Ce n’est pas une valeur officielle : c’est le montant auquel quelqu’un vient d’acheter à quelqu’un d’autre. Le prochain échange peut se faire ailleurs.',
      },
      {
        heading: 'La variation dépend de la période',
        body: 'Un titre « en hausse de 2 % » l’est sur la période affichée, pas dans l’absolu. Changez la période et le signe peut changer avec elle — c’est la même série lue de plus loin.',
      },
      {
        heading: 'Le pourcentage ne dit pas la somme',
        body: 'Deux pour cent sur une ligne de 50 000 F CFA et deux pour cent sur une ligne de 5 000 000 ne sont pas le même événement. C’est pourquoi le montant est toujours affiché à côté.',
      },
      {
        heading: 'L’écart est le coût du passage',
        body: 'Acheter se fait un peu au-dessus du cours et vendre un peu en dessous. La différence est notre rémunération, affichée en francs avant chaque confirmation. Un aller-retour immédiat coûte donc cet écart, deux fois.',
      },
    ],
    closing: 'Regardez la période longue avant la courte : sur un jour, le bruit domine. Ce qui compte pour un placement se voit sur un an.',
  },
}

/** The order the Learn page lists them in: what to do first, first. */
export const LESSON_ORDER: ReadonlyArray<LearnTopic> = ['epargne', 'cours', 'repartir', 'ipo', 'change', 'crypto']

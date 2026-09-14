/**
 * The short explanations that turn a listing into something somebody can act on.
 *
 * The roadmap asks for « pédagogie contextuelle » beside the market, and the reason is
 * specific to this product: most people buying their first share on the BRVM have never
 * bought one anywhere, and the words on the screen — introduction en bourse, cours, écart —
 * are the part that stops them, not the buttons.
 *
 * Each explanation is four or five sentences and ends by saying what to *do*, including
 * « rien pour l'instant » when that is the honest answer. A card that says « Comprendre une
 * IPO » and opens nothing is worse than no card, which is what the button did before this
 * existed: it had neither an `onClick` nor a `to`.
 */
import { Button, Sheet } from '@/components'
import styles from './LearnSheet.module.css'

export type LearnTopic = 'ipo' | 'cours'

interface Explanation {
  title: string
  points: ReadonlyArray<{ heading: string; body: string }>
  /** What to do now — often nothing, and saying so is the point. */
  closing: string
}

const EXPLANATIONS: Readonly<Record<LearnTopic, Explanation>> = {
  ipo: {
    title: 'Comprendre une introduction en bourse',
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

export function LearnSheet({ topic, open, onClose }: { topic: LearnTopic; open: boolean; onClose: () => void }) {
  const explanation = EXPLANATIONS[topic]
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={explanation.title}
      footer={
        <Button size="lg" block onClick={onClose}>
          J’ai compris
        </Button>
      }
    >
      <div className={styles.body}>
        {explanation.points.map((p) => (
          <section key={p.heading} className={styles.point}>
            <h3 className={styles.heading}>{p.heading}</h3>
            <p className={styles.text}>{p.body}</p>
          </section>
        ))}
        <p className={styles.closing}>{explanation.closing}</p>
      </div>
    </Sheet>
  )
}

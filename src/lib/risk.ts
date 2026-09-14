/**
 * The four questions, and how they add up to a profile.
 *
 * **The point is what the app says, not what it forbids.** A questionnaire that locks
 * somebody out of their own money is a different product; this one changes the sentence
 * shown beside a volatile order, which is the app's own rule — « warn before, not after »,
 * while the decision is still open.
 *
 * The questions are the four that actually separate people, and the scoring is deliberately
 * plain arithmetic rather than a weighting nobody can check: each answer is worth 0, 1 or 2,
 * and the total falls in one of three bands. Somebody who wants to know why they were
 * called prudent can count.
 */

export interface RiskAnswer {
  id: string
  label: string
  /** Plain, so the result can be explained. */
  score: 0 | 1 | 2
}

export interface RiskQuestion {
  id: string
  question: string
  /** Why it is being asked — an unexplained question feels like a test. */
  why: string
  answers: readonly RiskAnswer[]
}

export const RISK_QUESTIONS: readonly RiskQuestion[] = [
  {
    id: 'horizon',
    question: 'Dans combien de temps pensez-vous avoir besoin de cet argent ?',
    why: 'C’est la question qui compte le plus : une baisse n’a pas le même poids selon le temps qu’on peut lui laisser.',
    answers: [
      { id: 'court', label: 'Moins de deux ans', score: 0 },
      { id: 'moyen', label: 'Entre deux et cinq ans', score: 1 },
      { id: 'long', label: 'Plus de cinq ans', score: 2 },
    ],
  },
  {
    id: 'baisse',
    question: 'Vos placements perdent 20 % en un mois. Que faites-vous ?',
    why: 'Une baisse de 20 % arrive ; ce qu’on fait ce jour-là décide du reste.',
    answers: [
      { id: 'vendre', label: 'Je vends pour arrêter la perte', score: 0 },
      { id: 'attendre', label: 'Je ne touche à rien et j’attends', score: 1 },
      { id: 'acheter', label: 'J’en achète davantage', score: 2 },
    ],
  },
  {
    id: 'experience',
    question: 'Avez-vous déjà acheté des actions ou de la crypto ?',
    why: 'Pour savoir quoi expliquer, pas pour juger.',
    answers: [
      { id: 'jamais', label: 'Jamais', score: 0 },
      { id: 'un-peu', label: 'Quelques fois', score: 1 },
      { id: 'souvent', label: 'Régulièrement', score: 2 },
    ],
  },
  {
    id: 'part',
    question: 'Quelle part de votre épargne placez-vous ici ?',
    why: 'Ce qui est placé doit pouvoir être laissé tranquille.',
    answers: [
      { id: 'presque-tout', label: 'Presque toute mon épargne', score: 0 },
      { id: 'une-partie', label: 'Une partie, le reste est ailleurs', score: 1 },
      { id: 'une-petite-part', label: 'Une petite part seulement', score: 2 },
    ],
  },
]

export type RiskLevelId = 'prudent' | 'equilibre' | 'dynamique'

export interface RiskLevelInfo {
  id: RiskLevelId
  name: string
  /** One sentence someone would recognise themselves in. */
  summary: string
  /** What the app does differently — stated, because a silent effect is a hidden one. */
  effect: string
}

export const RISK_LEVELS: Readonly<Record<RiskLevelId, RiskLevelInfo>> = {
  prudent: {
    id: 'prudent',
    name: 'Prudent',
    summary: 'Vous préférez un capital qui bouge peu, et vous pourriez avoir besoin de cet argent assez vite.',
    effect: 'L’application vous prévient avant un ordre sur un actif volatil, et rappelle la part que cela représente. Elle ne vous empêche de rien.',
  },
  equilibre: {
    id: 'equilibre',
    name: 'Équilibré',
    summary: 'Vous acceptez des variations si elles servent un objectif à quelques années.',
    effect: 'Un rappel avant un ordre sur un actif volatil, rien de plus.',
  },
  dynamique: {
    id: 'dynamique',
    name: 'Dynamique',
    summary: 'Vous placez sur le long terme et une forte baisse ne vous fait pas vendre.',
    effect: 'Aucun rappel supplémentaire. Les frais et l’écart restent affichés avant chaque confirmation, comme pour tout le monde.',
  },
}

/** Maximum reachable score, exported so the result can show the arithmetic. */
export const RISK_MAX = RISK_QUESTIONS.length * 2

/**
 * Add up the answers.
 *
 * Bands at a third and two thirds of the range: with four questions that is 0–2 prudent,
 * 3–5 équilibré, 6–8 dynamique. An unanswered question scores zero, so a half-filled
 * questionnaire lands on the cautious side rather than flattering anybody.
 */
export function scoreAnswers(answers: Record<string, string>): number {
  let total = 0
  for (const q of RISK_QUESTIONS) {
    const chosen = q.answers.find((a) => a.id === answers[q.id])
    total += chosen?.score ?? 0
  }
  return total
}

export function levelForScore(score: number): RiskLevelId {
  if (score <= RISK_MAX / 3) return 'prudent'
  if (score <= (RISK_MAX * 2) / 3) return 'equilibre'
  return 'dynamique'
}

export function levelForAnswers(answers: Record<string, string>): RiskLevelId {
  return levelForScore(scoreAnswers(answers))
}

/** Every question answered — the questionnaire is short enough that partials help nobody. */
export function isComplete(answers: Record<string, string>): boolean {
  return RISK_QUESTIONS.every((q) => q.answers.some((a) => a.id === answers[q.id]))
}

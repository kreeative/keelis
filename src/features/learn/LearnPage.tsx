/**
 * /apprendre — Keewal Meere Learn.
 *
 * The owner gave the savings tab's seat to a book: Épargne is a row on Accueil, and a tab
 * that duplicates a row is a tab spent twice. What the book opens on is two things.
 *
 * **DP'PA — « les Derniers Papos à Propos de l'Argent ».** A *papo* is Ivorian nouchi for a
 * piece of news, the thing people tell each other; DP'PA reads like TL;DR and does the same
 * job. Each brief is a headline, the story in one line, and *why it matters to you* — what
 * it does to a balance, a rate or a price in this very app — with the source named, because
 * a brief with no source is a rumour. They come from the API (`api.learn.papos`), newest
 * first, because news is data; the demo's are demonstration content and the screen says so.
 *
 * **The lessons.** Financial literacy in six short pieces, each ending with what to *do*.
 * They are the same texts the market screen opens beside a listing — one file, two doors —
 * ordered here by what to do first: épargner avant d'investir is the first, and it is first
 * on purpose.
 */
import { useState } from 'react'
import { api } from '@/api'
import type { Papo } from '@/api/types'
import { AppBar, Badge, Card, ErrorState, Icon, List, ListRow, SectionHeader, SkeletonRow } from '@/components'
import { LearnSheet } from '@/features/crypto/LearnSheet'
import { formatDate } from '@/lib/format'
import { QK, useQuery, useSettings } from '@/store'
import { LESSONS, LESSON_ORDER, type LearnTopic } from './lessons'
import styles from './LearnPage.module.css'

/** What a tag reads as on a chip — the market or the currency the story sits in. */
const TAG_LABEL: Record<Papo['tag'], string> = {
  brvm: 'BRVM',
  ngx: 'NGX',
  bceao: 'BCEAO',
  fcfa: 'F CFA',
  naira: 'Naira',
  crypto: 'Crypto',
  epargne: 'Épargne',
}

export default function LearnPage() {
  const { locale } = useSettings()
  const papos = useQuery<Papo[]>(QK.papos, () => api.learn.papos())
  const [open, setOpen] = useState<LearnTopic | null>(null)

  return (
    <div className={`page ${styles.page}`}>
      <AppBar title="Learn" />

      <p className={`t-body t-muted ${styles.lede}`}>Keewal Meere Learn : la littératie financière, en clair, et les nouvelles qui touchent votre argent.</p>

      <section className={styles.section} aria-labelledby="dppa-title">
        <div className={styles.head}>
          <SectionHeader title="DP’PA" as="h2" className={styles.headTitle} />
          <p className={styles.headSub} id="dppa-title">
            Les Derniers Papos à Propos de l’Argent
          </p>
        </div>
        {papos.data === undefined && papos.error ? (
          <ErrorState error={papos.error} onRetry={() => void papos.refetch()} />
        ) : papos.data === undefined ? (
          <SkeletonRow count={3} />
        ) : (
          <ul className={styles.papos}>
            {papos.data.map((p) => (
              <li key={p.id}>
                <Card padding="lg" elevation={1} className={styles.papo}>
                  <div className={styles.papoMeta}>
                    <Badge tone="neutral" size="xs">
                      {TAG_LABEL[p.tag]}
                    </Badge>
                    <time dateTime={p.date} className={styles.papoDate}>
                      {formatDate(p.date, { locale, style: 'medium' })}
                    </time>
                  </div>
                  <h3 className={`t-h2 ${styles.papoTitle}`}>{p.title}</h3>
                  <p className={styles.papoTldr}>{p.tldr}</p>
                  {/* The line the whole rubric exists for: not what happened, but what it does
                      to the reader's own francs. */}
                  <p className={styles.papoWhy}>
                    <Icon name="arrow-right" size={16} className={styles.papoWhyIcon} />
                    <span>{p.why}</span>
                  </p>
                  <p className={styles.papoSource}>{p.source}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>Contenu de démonstration : ces brèves illustrent la rubrique, elles ne sont pas une source d’information.</p>
      </section>

      <section className={styles.section} aria-labelledby="lessons-title">
        <SectionHeader title="Leçons" as="h2" />
        <Card padding="none" elevation={1}>
          <List label="Leçons">
            {LESSON_ORDER.map((topic) => (
              <ListRow
                key={topic}
                leading={
                  <span className={styles.lessonIcon} aria-hidden="true">
                    <Icon name="book-open" size={20} />
                  </span>
                }
                title={LESSONS[topic].title}
                subtitle={LESSONS[topic].lede}
                wrap
                chevron
                onClick={() => setOpen(topic)}
              />
            ))}
          </List>
        </Card>
      </section>

      {open ? <LearnSheet topic={open} open onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

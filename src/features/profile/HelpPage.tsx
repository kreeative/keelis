/**
 * Aide — questions fréquentes filtrables, puis moyens de nous joindre.
 */
import { useMemo, useState } from 'react'
import { Button, EmptyState, Field, Icon, PageHeader } from '@/components'
import { useToast } from '@/store'
import { cn } from '@/lib/cn'
import { RowIcon } from './RowIcon'
import styles from './HelpPage.module.css'

interface Faq {
  id: string
  q: string
  a: string
}

const FAQ: ReadonlyArray<Faq> = [
  {
    id: 'frais',
    q: 'Quels frais s’appliquent à un achat de cryptomonnaie ?',
    a: 'Kaalis applique un écart (spread) sur le prix du marché, indiqué en pourcentage et en dollars avant chaque confirmation. Aucun frais fixe ne s’ajoute : le montant total affiché sur l’écran de confirmation est celui qui sera débité.',
  },
  {
    id: 'depots',
    q: 'Combien de temps prend un dépôt ?',
    a: 'Un e-Transfer arrive en quelques minutes. Un virement depuis une banque liée prend de un à trois jours ouvrables. Le délai estimé est affiché avant la confirmation, puis rappelé sur l’écran de suivi.',
  },
  {
    id: 'carte',
    q: 'Comment geler ma carte ?',
    a: 'Ouvrez l’onglet Carte et activez « Geler la carte ». Les paiements sont refusés immédiatement, les abonnements déjà autorisés compris. Vous pouvez la dégeler à tout moment, sans frais et sans nouvelle carte.',
  },
  {
    id: 'nip',
    q: 'Mon NIP est-il sécurisé ?',
    a: 'Le NIP déverrouille l’application sur cet appareil seulement. Il n’est jamais envoyé par courriel et aucun employé de Kaalis ne vous le demandera. Vous pouvez le changer dans Profil, puis Sécurité.',
  },
  {
    id: 'objectifs',
    q: 'Comment fonctionnent les objectifs d’épargne ?',
    a: 'Un objectif réserve une part de votre compte Épargne pour un projet précis. L’argent reste disponible et continue de générer des intérêts ; la date estimée se recalcule selon votre versement mensuel.',
  },
  {
    id: 'interets',
    q: 'Quand les intérêts sont-ils versés ?',
    a: 'Le taux annuel est de 4,00 %. Les intérêts se calculent chaque jour sur le solde et sont versés le premier jour de chaque mois, directement dans votre compte Épargne.',
  },
  {
    id: 'envoi-crypto',
    q: 'Puis-je annuler un envoi de cryptomonnaie ?',
    a: 'Non. Une fois diffusée sur le réseau, une transaction est irréversible et Kaalis ne peut pas la rappeler. Vérifiez l’adresse et le réseau avant de confirmer : les deux sont affichés une dernière fois sur l’écran de confirmation.',
  },
  {
    id: 'releves',
    q: 'Où trouver mes relevés ?',
    a: 'Dans Profil, puis Documents et relevés. Chaque mois y est déposé en PDF, pour le compte Chèque comme pour le compte Épargne. Les feuillets fiscaux se trouvent dans la section Fiscalité.',
  },
]

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export default function HelpPage() {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(FAQ[0]?.id ?? null)

  const results = useMemo(() => {
    const q = normalise(query.trim())
    if (!q) return FAQ
    return FAQ.filter((f) => normalise(f.q).includes(q) || normalise(f.a).includes(q))
  }, [query])

  return (
    <div className={styles.page}>
      <PageHeader back="/profil" title="Aide" />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Field
            label="Rechercher une question"
            hideLabel
            type="search"
            placeholder="Rechercher une question"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leading={<Icon name="search" size={20} />}
            trailing={
              query ? (
                <Button variant="ghost" iconOnly aria-label="Effacer la recherche" onClick={() => setQuery('')}>
                  <Icon name="x" size={18} />
                </Button>
              ) : undefined
            }
            className={styles.search}
          />

          <h2 className="t-section" id="faq-title">
            Questions fréquentes
          </h2>
          <section className={styles.faq} aria-labelledby="faq-title">
            {results.length === 0 ? (
              <EmptyState compact message="Aucune réponse ne correspond à cette recherche." />
            ) : (
              results.map((f) => {
                const isOpen = open === f.id
                return (
                  <div key={f.id} className={styles.item}>
                    <h3 className={styles.heading}>
                      <button
                        type="button"
                        id={`faq-${f.id}-btn`}
                        className={styles.trigger}
                        aria-expanded={isOpen}
                        aria-controls={`faq-${f.id}-panel`}
                        onClick={() => setOpen(isOpen ? null : f.id)}
                      >
                        <span className={styles.question}>{f.q}</span>
                        <Icon name="chevron-down" size={20} className={cn(styles.chevron, isOpen && styles.chevronOpen)} />
                      </button>
                    </h3>
                    <div id={`faq-${f.id}-panel`} role="region" aria-labelledby={`faq-${f.id}-btn`} className={styles.panel} hidden={!isOpen}>
                      <p className={styles.answer}>{f.a}</p>
                    </div>
                  </div>
                )
              })
            )}
          </section>
        </div>

        <aside className={styles.side} aria-labelledby="contact-title">
          <h2 className="t-section" id="contact-title">
            Nous joindre
          </h2>
          <div className={styles.contacts}>
            <button type="button" className={styles.contact} onClick={() => toast('Le clavardage arrive bientôt')}>
              <RowIcon name="send" />
              <span className={styles.contactText}>
                <span className={styles.contactTitle}>Clavarder</span>
                <span className={styles.contactSub}>Réponse en quelques minutes</span>
              </span>
              <Icon name="chevron-right" className={styles.contactChevron} />
            </button>
            <a className={styles.contact} href="mailto:aide@kaalis.ca">
              <RowIcon name="mail" />
              <span className={styles.contactText}>
                <span className={styles.contactTitle}>Courriel</span>
                <span className={styles.contactSub}>aide@kaalis.ca</span>
              </span>
              <Icon name="chevron-right" className={styles.contactChevron} />
            </a>
            <a className={styles.contact} href="tel:+15145550100">
              <RowIcon name="smartphone" />
              <span className={styles.contactText}>
                <span className={styles.contactTitle}>Téléphone</span>
                <span className={styles.contactSub}>514 555-0100 · 7 h à 21 h</span>
              </span>
              <Icon name="chevron-right" className={styles.contactChevron} />
            </a>
          </div>
          <p className={styles.note}>En cas de fraude, appelez-nous : nous gelons la carte pendant l’appel.</p>
        </aside>
      </div>
    </div>
  )
}

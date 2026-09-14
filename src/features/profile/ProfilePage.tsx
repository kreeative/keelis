/**
 * Profil — identité, accès aux réglages, préférences d’affichage, déconnexion.
 * Desktop : les groupes de réglages à gauche, l’identité et la déconnexion en colonne de droite.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, isLive, type Locale } from '@/api'
import { Avatar, Badge, Button, Icon, List, ListRow, SegmentedControl, Switch } from '@/components'
import { ConfirmSheet } from '@/features/shared'
import { formatDate } from '@/lib/format'
import type { ThemeChoice } from '@/lib/theme'
import { useSession, useSettings, useToast } from '@/store'
import { RowIcon } from './RowIcon'
import { SettingRow } from './SettingRow'
import styles from './ProfilePage.module.css'

const THEME_SEGMENTS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

const LOCALE_SEGMENTS: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: 'fr-SN', label: 'Français' },
  { value: 'en-NG', label: 'English' },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, signOut } = useSession()
  const { theme, setTheme, locale, setLocale, hidden, toggleHidden } = useSettings()
  const { toast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const fullName = user ? `${user.firstName} ${user.lastName}` : ''

  const onLocale = (next: Locale) => {
    setLocale(next)
    void api.profile.update({ locale: next }).catch(() => toast('Langue non enregistrée sur le compte.', 'error'))
  }

  const onSignOut = async () => {
    setPending(true)
    setError(null)
    try {
      await signOut()
      navigate('/bienvenue')
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('Déconnexion impossible pour l’instant.', 'unknown'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <header className={styles.identity}>
          <Avatar label={fullName || 'Keewal Meere'} size={56} tone="accent" />
          <h1 className={`t-h1 ${styles.name}`}>{fullName || 'Votre profil'}</h1>
          <p className={`t-small ${styles.email}`}>{user?.email}</p>
          <div className={styles.meta}>
            {user?.verified ? (
              <Badge tone="accent" icon={<Icon name="shield-check" />}>
                Vérifié
              </Badge>
            ) : null}
            {user ? <p className={styles.since}>Membre depuis {formatDate(user.createdAt, { locale, style: 'medium' })}</p> : null}
          </div>
        </header>

        <div className={styles.groups}>
          <section className={styles.group} aria-labelledby="grp-compte">
            <h2 className="t-section" id="grp-compte">
              Compte
            </h2>
            <List>
              <ListRow to="/profil/securite" leading={<RowIcon name="shield" />} title="Sécurité" subtitle="NIP et appareils" chevron />
              <ListRow to="/profil/notifications" leading={<RowIcon name="bell" />} title="Notifications" subtitle="Ce dont nous vous avertissons" chevron />
              <ListRow to="/profil/documents" leading={<RowIcon name="file-text" />} title="Documents et relevés" subtitle="Relevés mensuels en PDF" chevron />
              <ListRow to="/profil/fiscalite" leading={<RowIcon name="receipt" />} title="Fiscalité" subtitle="Feuillets et rapports annuels" chevron />
            </List>
          </section>

          <section className={styles.group} aria-labelledby="grp-pref">
            <h2 className="t-section" id="grp-pref">
              Préférences
            </h2>
            <List>
              <SettingRow
                leading={<RowIcon name="sun" />}
                title="Apparence"
                subtitle="Thème de l’application"
                wide
                control={<SegmentedControl segments={THEME_SEGMENTS} value={theme} onChange={setTheme} label="Apparence" size="sm" />}
              />
              <SettingRow
                leading={<RowIcon name="languages" />}
                title="Langue et format"
                subtitle="Nombres, dates et devises"
                wide
                control={<SegmentedControl segments={LOCALE_SEGMENTS} value={locale} onChange={onLocale} label="Langue et format" size="sm" />}
              />
              <SettingRow
                leading={<RowIcon name="eye-off" />}
                title="Masquer les soldes"
                subtitle="Les montants deviennent des points"
                control={<Switch checked={hidden} onChange={toggleHidden} label="Masquer les soldes" />}
              />
            </List>
          </section>

          <section className={styles.group} aria-labelledby="grp-aide">
            <h2 className="t-section" id="grp-aide">
              Assistance
            </h2>
            <List>
              <ListRow to="/profil/aide" leading={<RowIcon name="help-circle" />} title="Aide" subtitle="Questions fréquentes" chevron />
              {/* Where every figure on screen comes from — and, while there is no back-end,
                  the one place that says plainly which of them are invented. */}
              <ListRow
                to="/profil/donnees"
                leading={<RowIcon name="link-2" />}
                title="Données et connexion"
                subtitle={isLive ? 'Connecté à un back-end' : 'Mode démonstration'}
                chevron
              />
              <div className={styles.aboutRow}>
                <RowIcon name="info" />
                <span className={styles.aboutText}>
                  <span className={styles.aboutTitle}>À propos</span>
                  <span className={styles.about}>Keewal Meere 0.1.0 · Conditions · Confidentialité</span>
                </span>
              </div>
            </List>
          </section>
        </div>

        <div className={styles.signOut}>
          <Button variant="destructive" block icon={<Icon name="log-out" size={18} />} onClick={() => setConfirming(true)}>
            Se déconnecter
          </Button>
        </div>
      </div>

      {/* The build this device is actually running. Without it, "it still looks wrong" and
          "the fix is deployed" can both be true and nobody can tell. */}
      <p className={styles.build}>Version {__BUILD_ID__}</p>

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Se déconnecter"
        lines={[
          { label: 'Compte', value: user?.email ?? '—' },
          { label: 'Appareil', value: 'Cet appareil' },
        ]}
        note="Vos données restent en sécurité. Un code vous sera demandé à la prochaine connexion."
        confirmLabel="Se déconnecter"
        destructive
        pending={pending}
        error={error}
        onConfirm={() => void onSignOut()}
      />
    </div>
  )
}

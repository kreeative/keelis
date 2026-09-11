/**
 * Sécurité — double authentification, biométrie, NIP, verrouillage, appareils connectés.
 * Les bascules sont optimistes : l’état change tout de suite et revient en arrière en cas d’échec.
 */
import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type Device, type SecuritySettings } from '@/api'
import { Badge, Button, ErrorState, Icon, List, ListRow, SegmentedControl, Skeleton, Switch, PageHeader } from '@/components'
import { ConfirmSheet } from '@/features/shared'
import { formatRelative } from '@/lib/format'
import { QK, invalidate, useQuery, useSession, useSettings, useToast } from '@/store'
import { PinSheet } from './PinSheet'
import { RowIcon } from './RowIcon'
import { SettingRow } from './SettingRow'
import styles from './SecurityPage.module.css'

type TimeoutValue = '5' | '10' | '30'

const TIMEOUTS: ReadonlyArray<{ value: TimeoutValue; label: string }> = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '30', label: '30 min' },
]

function toTimeout(minutes: number): TimeoutValue {
  if (minutes <= 5) return '5'
  if (minutes >= 30) return '30'
  return '10'
}

function deviceIcon(platform: string) {
  const p = platform.toLowerCase()
  if (p.includes('ios') || p.includes('android')) return 'smartphone' as const
  if (p.includes('navigateur')) return 'globe' as const
  return 'monitor' as const
}

export default function SecurityPage() {
  const { security, refreshSecurity, lock } = useSession()
  const { locale } = useSettings()
  const { toast } = useToast()
  const devices = useQuery<Device[]>(QK.devices, () => api.profile.devices())

  const [draft, setDraft] = useState<SecuritySettings | null>(null)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [revoking, setRevoking] = useState<Device | null>(null)
  const [revokePending, setRevokePending] = useState(false)
  const [revokeError, setRevokeError] = useState<ApiError | null>(null)

  const value = draft ?? security

  // La session charge les réglages au démarrage ; si cet appel a échoué (hors ligne),
  // on réessaie ici et on propose une action plutôt que des squelettes sans fin.
  const loadSecurity = useCallback(async () => {
    setLoadError(null)
    try {
      await refreshSecurity()
    } catch (e) {
      setLoadError(e instanceof ApiError ? e : new ApiError('Réglages indisponibles pour l’instant.', 'unknown'))
    }
  }, [refreshSecurity])

  useEffect(() => {
    if (security || loadError) return
    void loadSecurity()
  }, [security, loadError, loadSecurity])

  const apply = async (patch: Partial<SecuritySettings>, message: string) => {
    if (!value) return
    const previous = value
    setDraft({ ...value, ...patch })
    try {
      await api.profile.setSecurity(patch)
      await refreshSecurity()
      setDraft(null)
      toast(message)
    } catch {
      setDraft(previous)
      toast('Modification impossible. Réessayez.', 'error')
    }
  }

  const onRevoke = async () => {
    if (!revoking) return
    setRevokePending(true)
    setRevokeError(null)
    try {
      await api.profile.revokeDevice(revoking.id)
      invalidate(QK.devices)
      toast('Appareil révoqué')
      setRevoking(null)
    } catch (e) {
      setRevokeError(e instanceof ApiError ? e : new ApiError('Révocation impossible.', 'unknown'))
    } finally {
      setRevokePending(false)
    }
  }

  const list = devices.data

  return (
    <div className={styles.page}>
      <PageHeader back="/profil" title="Sécurité" />
      <p className={styles.intro}>Ces réglages protègent votre argent sur cet appareil et sur les autres.</p>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="sec-acces">
            <h2 className="t-label" id="sec-acces">
              Accès au compte
            </h2>
            {loadError && !value ? (
              <ErrorState compact error={loadError} onRetry={() => void loadSecurity()} />
            ) : value ? (
              <List>
                <SettingRow
                  leading={<RowIcon name="shield-check" />}
                  title="Double authentification"
                  subtitle="Un code vous est demandé à chaque connexion"
                  control={<Switch checked={value.twoFactorEnabled} onChange={(v) => void apply({ twoFactorEnabled: v }, v ? 'Double authentification activée' : 'Double authentification désactivée')} label="Double authentification" />}
                />
                <SettingRow
                  leading={<RowIcon name="fingerprint" />}
                  title="Biométrie"
                  subtitle="Empreinte ou visage pour déverrouiller"
                  control={<Switch checked={value.biometricsEnabled} onChange={(v) => void apply({ biometricsEnabled: v }, v ? 'Biométrie activée' : 'Biométrie désactivée')} label="Biométrie" />}
                />
              </List>
            ) : (
              <div className={styles.skeletons}>
                <Skeleton height={64} shape="card" />
                <Skeleton height={64} shape="card" />
              </div>
            )}
          </section>

          <section className={styles.section} aria-labelledby="sec-verrou">
            <h2 className="t-label" id="sec-verrou">
              NIP et verrouillage
            </h2>
            {loadError && !value ? null : value ? (
              <List>
                <ListRow
                  onClick={() => setPinOpen(true)}
                  leading={<RowIcon name="lock-keyhole" />}
                  title="Changer le NIP"
                  subtitle={<span className={styles.wrap}>{value.pinSet ? 'Quatre chiffres, demandés au déverrouillage' : 'Aucun NIP défini pour l’instant'}</span>}
                  chevron
                />
                <SettingRow
                  leading={<RowIcon name="clock" />}
                  title="Verrouillage automatique"
                  subtitle="Après une période d’inactivité"
                  wide
                  control={
                    <SegmentedControl
                      segments={TIMEOUTS}
                      value={toTimeout(value.sessionTimeoutMinutes)}
                      onChange={(v) => void apply({ sessionTimeoutMinutes: Number(v) }, `Verrouillage après ${v} minutes`)}
                      label="Verrouillage automatique"
                      size="sm"
                    />
                  }
                />
                <ListRow onClick={lock} leading={<RowIcon name="lock" />} title="Verrouiller maintenant" subtitle={<span className={styles.wrap}>Le NIP sera demandé immédiatement</span>} chevron />
              </List>
            ) : (
              <div className={styles.skeletons}>
                <Skeleton height={64} shape="card" />
                <Skeleton height={64} shape="card" />
                <Skeleton height={64} shape="card" />
              </div>
            )}
          </section>
        </div>

        <aside className={styles.side} aria-labelledby="sec-appareils">
          <h2 className="t-label" id="sec-appareils">
            Appareils
          </h2>
          {devices.loading ? (
            <div className={styles.skeletons}>
              <Skeleton height={64} shape="card" />
              <Skeleton height={64} shape="card" />
              <Skeleton height={64} shape="card" />
            </div>
          ) : devices.error && !list ? (
            <ErrorState compact error={devices.error} onRetry={() => void devices.refetch()} />
          ) : (
            <>
              <List>
                {list?.map((d) => (
                  <ListRow
                    key={d.id}
                    static
                    leading={<RowIcon name={deviceIcon(d.platform)} tone={d.current ? 'accent' : 'neutral'} />}
                    title={d.name}
                    subtitle={<span className={styles.wrap}>{d.current ? d.platform : `${d.platform} · Actif ${formatRelative(d.lastActive, { locale })}`}</span>}
                    trailing={
                      d.current ? (
                        <Badge tone="neutral">Cet appareil</Badge>
                      ) : (
                        <Button variant="ghost" iconOnly aria-label={`Révoquer ${d.name}`} onClick={() => setRevoking(d)}>
                          <Icon name="trash-2" size={20} />
                        </Button>
                      )
                    }
                  />
                ))}
              </List>
              <p className={styles.note}>Un appareil révoqué doit se reconnecter avec un code.</p>
            </>
          )}
        </aside>
      </div>

      <PinSheet
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onSaved={() => {
          setPinOpen(false)
          void refreshSecurity()
          toast('NIP mis à jour')
        }}
      />

      <ConfirmSheet
        open={revoking !== null}
        onClose={() => {
          setRevoking(null)
          setRevokeError(null)
        }}
        title="Révoquer cet appareil"
        lines={[
          { label: 'Appareil', value: revoking?.name ?? '—' },
          { label: 'Plateforme', value: revoking?.platform ?? '—' },
          { label: 'Dernière activité', value: revoking ? formatRelative(revoking.lastActive, { locale }) : '—' },
        ]}
        note="La session ouverte sur cet appareil sera fermée immédiatement."
        confirmLabel="Révoquer"
        destructive
        pending={revokePending}
        error={revokeError}
        onConfirm={() => void onRevoke()}
      />
    </div>
  )
}

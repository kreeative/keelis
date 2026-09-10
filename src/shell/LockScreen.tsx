/**
 * Full-screen PIN lock shown when returning from background or after idle timeout.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Keypad, keypadReduce } from '@/components/Keypad'
import { Button } from '@/components/Button'
import { Wordmark } from '@/components/Wordmark'
import { Icon } from '@/components/Icon'
import { useSession } from '@/store/session'
import styles from './LockScreen.module.css'

export function LockScreen() {
  const { unlock, signOut, security, user } = useSession()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (pin.length !== 4) return
    let alive = true
    setBusy(true)
    unlock(pin)
      .then((ok) => {
        if (!alive) return
        if (!ok) {
          setError('NIP incorrect')
          setPin('')
        }
      })
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [pin, unlock])

  const onKey = (e: React.KeyboardEvent) => {
    if (/^\d$/.test(e.key) || e.key === 'Backspace') {
      e.preventDefault()
      setError(null)
      setPin((p) => keypadReduce(p, e.key === 'Backspace' ? 'back' : e.key, { integerOnly: true, maxLength: 4 }))
    }
  }

  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true" aria-labelledby="lock-title" onKeyDown={onKey} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className={styles.inner}>
        <Wordmark size="sm" />
        <div className={styles.center}>
          <Icon name="lock-keyhole" className={styles.lockIcon} />
          <h1 id="lock-title" className="t-h2">
            {user ? `Bonjour ${user.firstName}` : 'Kaalis verrouillé'}
          </h1>
          <p className="t-small t-muted">{security?.biometricsEnabled ? 'Entrez votre NIP ou utilisez la biométrie' : 'Entrez votre NIP pour continuer'}</p>
          <div className={styles.dots} aria-label={`${pin.length} chiffres saisis sur 4`} role="status">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i < pin.length ? styles.dotOn : styles.dot} />
            ))}
          </div>
          <p className={styles.error} role="alert">
            {error ?? ' '}
          </p>
        </div>
        <Keypad
          value={pin}
          onChange={(v) => {
            setError(null)
            setPin(v)
          }}
          integerOnly
          maxLength={4}
          disabled={busy}
        />
        {security?.biometricsEnabled ? (
          <Button variant="ghost" icon={<Icon name="fingerprint" />} onClick={() => setPin('1234')}>
            Biométrie
          </Button>
        ) : null}
        <p className={styles.hint}>NIP de démonstration : 1234</p>
        <Button variant="ghost" onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    </div>,
    document.body,
  )
}

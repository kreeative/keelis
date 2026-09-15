/**
 * Changement de NIP : saisie, confirmation, puis enregistrement.
 * Deux passes de quatre chiffres ; la seconde doit être identique.
 * L’enregistrement part d’une action de saisie (jamais d’un effet) : pas de double envoi.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/api'
import { Button, Keypad, Sheet } from '@/components'
import { cn } from '@/lib/cn'
import styles from './PinSheet.module.css'

const LENGTH = 4

export function PinSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [step, setStep] = useState<'first' | 'second'>('first')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const sending = useRef(false)

  useEffect(() => {
    if (open) return
    setFirst('')
    setSecond('')
    setStep('first')
    setError(null)
    setPending(false)
    sending.current = false
  }, [open])

  const save = useCallback(
    async (pin: string) => {
      if (sending.current) return
      sending.current = true
      setPending(true)
      try {
        await api.auth.setPin(pin)
        onSaved()
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Enregistrement impossible. Réessayez.')
        setFirst('')
        setSecond('')
        setStep('first')
      } finally {
        sending.current = false
        setPending(false)
      }
    },
    [onSaved],
  )

  const value = step === 'first' ? first : second

  const commit = useCallback(
    (next: string) => {
      if (pending) return
      setError(null)
      if (step === 'first') {
        setFirst(next)
        if (next.length === LENGTH) {
          setSecond('')
          setStep('second')
        }
        return
      }
      setSecond(next)
      if (next.length < LENGTH) return
      if (next !== first) {
        setError('Les deux NIP ne correspondent pas.')
        setSecond('')
        return
      }
      void save(next)
    },
    [pending, step, first, save],
  )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Changer le NIP"
      locked={pending}
      footer={
        <Button variant="ghost" block onClick={onClose} disabled={pending}>
          Annuler
        </Button>
      }
    >
      <div className={styles.body}>
        <p className={styles.step} aria-live="polite">
          {step === 'first' ? 'Choisissez un NIP de quatre chiffres.' : 'Entrez-le une seconde fois.'}
        </p>
        <div className={styles.dots} role="status" aria-label={`${value.length} chiffre${value.length > 1 ? 's' : ''} sur ${LENGTH}`}>
          {Array.from({ length: LENGTH }).map((_, i) => (
            <span key={i} className={cn(styles.dot, i < value.length && styles.dotOn)} />
          ))}
        </div>
        <p className={styles.error} role="alert">
          {error ?? ' '}
        </p>
        <Keypad value={value} onChange={commit} integerOnly maxLength={LENGTH} disabled={pending} />
      </div>
    </Sheet>
  )
}

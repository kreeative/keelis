import { useRef, useState, type DragEvent } from 'react'
import { api } from '@/api'
import { Button, Icon } from '@/components'
import { formatNumber } from '@/lib/format'
import { useSettings } from '@/store'
import { cn } from '@/lib/cn'
import { StepShell } from './StepShell'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import styles from './Steps.module.css'

const ACCEPT = 'image/*,application/pdf'
const MAX_MB = 15

interface Picked {
  name: string
  size: number
  type: string
}

/** « 840 Ko », « 2,4 Mo » — the unit that keeps the number readable. */
function formatSize(bytes: number, locale: 'fr-SN' | 'en-NG'): string {
  if (bytes < 1024 * 1024) return `${formatNumber(Math.max(1, Math.round(bytes / 1024)), { locale, maxFraction: 0 })} Ko`
  return `${formatNumber(bytes / 1024 / 1024, { locale, maxFraction: 1, minFraction: 1 })} Mo`
}

export function StepDocument() {
  const { merge, goNext } = useWizard()
  const { locale } = useSettings()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<Picked | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = (picked: File | undefined) => {
    if (!picked) return
    setError(null)
    setFile({ name: picked.name, size: picked.size, type: picked.type })
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files?.[0])
  }

  const submit = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await api.auth.uploadIdentityDocument(file)
      merge({ documentUploaded: true, step: 'twofactor' })
      goNext('piece')
    } catch (err) {
      const apiErr = asApiError(err, 'Le téléversement a échoué. Réessayez.')
      setError(apiErr.details?.file ?? apiErr.message)
    } finally {
      setBusy(false)
    }
  }

  const size = file ? formatSize(file.size, locale) : null

  return (
    <StepShell
      eyebrow={stepEyebrow('piece')}
      title="Ajoutez une pièce d’identité"
      description="Permis de conduire, passeport ou carte d’assurance maladie, recto entier et lisible."
      submitDisabled={!file}
      submitting={busy}
      onSubmit={() => void submit()}
    >
      <div
        className={cn(styles.drop, dragging && styles.dropActive)}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-live="polite"
      >
        <Icon name={file ? 'file-text' : 'upload'} className={styles.dropIcon} />
        {file ? (
          <>
            <p className={styles.dropName}>{file.name}</p>
            <p className={styles.dropMeta}>{size}</p>
            <Button variant="ghost" onClick={() => input.current?.click()}>
              Remplacer
            </Button>
          </>
        ) : (
          <>
            <p className={styles.dropName}>Déposez votre document ici</p>
            <p className={styles.dropMeta}>Photo ou PDF · {MAX_MB} Mo max</p>
            <Button variant="ghost" onClick={() => input.current?.click()}>
              Choisir un fichier
            </Button>
          </>
        )}
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.note}>Vos documents sont chiffrés et supprimés après vérification.</p>
    </StepShell>
  )
}

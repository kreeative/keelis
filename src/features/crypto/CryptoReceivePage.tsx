/**
 * /crypto/:id/recevoir — deposit address for the selected network, as QR + copyable text.
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api'
import type { ReceiveAddress } from '@/api/types'
import { Button, ErrorState, Icon, PageHeader, QRCode, SegmentedControl, Skeleton } from '@/components'
import { useToast } from '@/store'
import { cn } from '@/lib/cn'
import { useLiveAsset, useLiveQuery } from './hooks'
import styles from './CryptoReceivePage.module.css'

const QR_SIZE = 200
/** QRCode adds --sp-3 padding + 1px border on each side. */
const QR_BOX = QR_SIZE + 2 * 12 + 2

export default function CryptoReceivePage() {
  const { id = '' } = useParams()
  const { toast } = useToast()
  const assetQ = useLiveAsset(id)
  const asset = assetQ.data
  const [networkId, setNetworkId] = useState<string | null>(null)
  const networks = asset?.networks ?? []
  const network = networks.find((n) => n.id === networkId) ?? networks[0]

  const key = asset && network ? `crypto:receive/${asset.id}/${network.id}` : null
  const addr = useLiveQuery<ReceiveAddress>(key, () => api.crypto.receiveAddress(asset!.id, network!.id), { staleTime: 5 * 60_000 })

  const copy = async () => {
    if (!addr.data) return
    try {
      await navigator.clipboard.writeText(addr.data.address)
      toast('Adresse copiée')
    } catch {
      toast("Impossible de copier l'adresse", 'error')
    }
  }

  if (!asset || !network) {
    return (
      <div className={cn('page', styles.receive)}>
        <PageHeader close back={`/crypto/${id}`} title="Recevoir" />
        {assetQ.error ? (
          <ErrorState error={assetQ.error} onRetry={() => void assetQ.refetch()} />
        ) : (
          <div className={styles.center} aria-busy="true">
            <Skeleton shape="card" width={QR_BOX} height={QR_BOX} />
          </div>
        )}
      </div>
    )
  }

  const loadingAddress = addr.data === undefined && !addr.error

  return (
    <div className={cn('page', styles.receive)}>
      <PageHeader close back={`/crypto/${id}`} title={`Recevoir ${asset.symbol}`} eyebrow={asset.name} />

      {networks.length > 1 ? (
        <section className={styles.block} aria-labelledby="network-title">
          <h2 id="network-title" className="t-label">
            Réseau
          </h2>
          <SegmentedControl segments={networks.map((n) => ({ value: n.id, label: n.name }))} value={network.id} onChange={setNetworkId} label="Réseau" block className={styles.tabs} />
        </section>
      ) : (
        <section className={styles.block} aria-labelledby="network-title">
          <h2 id="network-title" className="t-label">
            Réseau
          </h2>
          <p>{network.name}</p>
        </section>
      )}

      <section className={styles.center} aria-label="Adresse de réception" aria-busy={loadingAddress || undefined}>
        {addr.error && !addr.data ? (
          <ErrorState error={addr.error} onRetry={() => void addr.refetch()} compact />
        ) : (
          <>
            {addr.data ? <QRCode value={addr.data.qrPayload} size={QR_SIZE} label="Code QR de l'adresse" /> : <Skeleton shape="card" width={QR_BOX} height={QR_BOX} />}
            {addr.data ? (
              <p className={cn(styles.address, addr.refetching && styles.refetching)} aria-label={`Adresse ${network.name}`}>
                {addr.data.address}
              </p>
            ) : (
              <Skeleton shape="text" height={72} />
            )}
            <Button variant="secondary" size="lg" block onClick={() => void copy()} disabled={!addr.data} icon={<Icon name="copy" size={18} />}>
              Copier l'adresse
            </Button>
          </>
        )}
        <p className={styles.warning} role="note">
          <Icon name="circle-alert" size={18} className={styles.warningIcon} />
          <span>{network.warning}</span>
        </p>
      </section>
    </div>
  )
}

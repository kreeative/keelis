/**
 * /crypto/:id/envoyer — network → address → quantity → network fee preview → confirm → send.
 * Sends are irreversible: the confirmation sheet repeats the destination, network and total.
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api'
import type { ApiError, CryptoAsset, CryptoSendPreview, CryptoSendRequest, Locale, MoneyMovementResult } from '@/api/types'
import { Button, Callout, ChoiceList, ErrorState, Field, Icon, PageHeader, SkeletonAmount } from '@/components'
import { AmountEntry, ConfirmSheet, ReviewList, StepFlow, SuccessScreen, useTransaction, type FlowStep, type SummaryLine } from '@/features/shared'
import { formatCrypto, formatMoney, parseAmountInput } from '@/lib/format'
import { useMutation, useSettings, useToast } from '@/store'
import { cn } from '@/lib/cn'
import { abbreviateAddress, floorTo, toKeypadRaw } from './cryptoFormat'
import { useLiveAsset, useLiveHoldings } from './hooks'
import styles from './CryptoSendPage.module.css'

/**
 * The receipt, which follows the transaction.
 *
 * A chain send is the one movement in this app that genuinely *is* pending for a while, so
 * « En attente » is honest here in a way it was not on the internal transfer. What was
 * wrong is that it stayed that way: the send confirms within the minutes the screen itself
 * quotes, the event reaches the cache, and the page that told you to wait never said it was
 * over. The word is « Confirmé » rather than « Réglé » — a network confirms a send; a ledger
 * settles a payment.
 */
function SendSuccess({ result, asset, locale }: { result: { res: MoneyMovementResult; req: CryptoSendRequest; preview: CryptoSendPreview }; asset: CryptoAsset; locale: Locale }) {
  const tx = useTransaction(result.res.transactionId)
  const net = asset.networks.find((n) => n.id === result.req.networkId)
  const confirmed = tx.data?.status === 'posted'
  const failed = tx.data?.status === 'failed' || tx.data?.status === 'reversed'
  return (
    <SuccessScreen
      title={confirmed ? 'Envoi confirmé' : 'Envoi en cours'}
      hero={formatCrypto(result.preview.quantity, asset.symbol, { locale })}
      caption={`vers ${abbreviateAddress(result.req.address)}`}
      status={failed ? 'Échouée' : confirmed ? 'Confirmé' : `En attente · ${result.res.eta}`}
      details={[
        { label: 'Adresse', value: <span className={styles.mono}>{abbreviateAddress(result.req.address)}</span> },
        { label: 'Réseau', value: net?.name ?? result.req.networkId },
        { label: 'Frais réseau', value: formatCrypto(result.preview.networkFee, asset.symbol, { locale }) },
        { label: 'Total débité', value: formatCrypto(result.preview.totalDebit, asset.symbol, { locale }) },
      ]}
      primaryLabel={`Voir ${asset.symbol}`}
      primaryTo={`/crypto/${result.req.assetId}`}
      secondaryLabel="Retour à l’accueil"
      secondaryTo="/"
    />
  )
}



export default function CryptoSendPage() {
  const { id = '' } = useParams()
  const { locale } = useSettings()
  const { toast } = useToast()
  const assetQ = useLiveAsset(id)
  const asset = assetQ.data
  const holdings = useLiveHoldings()
  const holding = holdings.data?.find((h) => h.assetId === id)

  const [networkId, setNetworkId] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [addressError, setAddressError] = useState<string | null>(null)
  const [raw, setRaw] = useState('')
  const [entryError, setEntryError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CryptoSendPreview | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [result, setResult] = useState<{ res: MoneyMovementResult; req: CryptoSendRequest; preview: CryptoSendPreview } | null>(null)

  const previewM = useMutation((req: CryptoSendRequest) => api.crypto.previewSend(req))
  const sendM = useMutation((req: CryptoSendRequest) => api.crypto.send(req))

  const networks = asset?.networks ?? []
  const network = networks.find((n) => n.id === networkId) ?? networks[0]
  const decimals = asset?.decimals ?? 8
  const price = asset?.price ?? 0
  const fee = network?.feeEstimate ?? 0
  const quantity = parseAmountInput(raw)
  const totalDebit = quantity + fee
  const held = holding?.quantity ?? 0

  /* The API refuses a mismatched address, but only once the whole form is submitted.
     The kit asks for timely assistance during the task, so flag it while typing — as a
     warning, not an error: an address we do not recognise may still be valid. */
  const addressWarning = (() => {
    const a = address.trim()
    if (!a || addressError || !network?.addressPrefix) return null
    if (a.startsWith(network.addressPrefix)) return null
    return `Une adresse ${network.name} commence habituellement par « ${network.addressPrefix} ».`
  })()

  const clientError = (() => {
    if (quantity <= 0) return null
    if (holdings.data && totalDebit > held + 1e-12) return 'Avoirs insuffisants (frais réseau inclus)'
    return null
  })()
  const shownEntryError = entryError ?? clientError
  const canContinue = !!asset && !!network && quantity > 0 && address.trim().length > 0 && !clientError && !previewM.pending

  const request = (): CryptoSendRequest | null => (asset && network ? { assetId: asset.id, networkId: network.id, address: address.trim(), quantity } : null)

  const onPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        toast('Le presse-papiers est vide', 'error')
        return
      }
      setAddress(text.trim())
      setAddressError(null)
    } catch {
      toast('Impossible de lire le presse-papiers', 'error')
    }
  }

  const onMax = () => {
    setRaw(toKeypadRaw(floorTo(Math.max(0, held - fee), decimals), decimals))
    setEntryError(null)
  }

  const onContinue = async () => {
    const req = request()
    if (!req) return
    setAddressError(null)
    setEntryError(null)
    try {
      const p = await previewM.mutate(req)
      setPreview(p)
      sendM.reset()
      setSheetOpen(true)
    } catch (err) {
      const e = err as ApiError
      if (e.details?.address) setAddressError(e.details.address)
      else setEntryError(e.message)
    }
  }

  const onConfirm = async () => {
    const req = request()
    if (!req || !preview) return
    try {
      const res = await sendM.mutate(req)
      setSheetOpen(false)
      setResult({ res, req, preview })
    } catch {
      /* shown inline in the sheet */
    }
  }

  if (result && asset) {
    return (
      <div className={cn('page', styles.send)}>
        <SendSuccess result={result} asset={asset} locale={locale} />
      </div>
    )
  }

  if (!asset || !network) {
    return (
      <div className={cn('page', styles.send)}>
        <PageHeader close back={`/crypto/${id}`} title="Envoyer" />
        {assetQ.error ? <ErrorState error={assetQ.error} onRetry={() => void assetQ.refetch()} /> : <SkeletonAmount />}
      </div>
    )
  }

  /* The aperçu's lines. The sheet re-states them from the server's `preview`, which is the
     figure that will actually be signed — this is the indicative one, and the step says so. */
  const lines: SummaryLine[] = [
    { label: 'Destination', value: <span className={styles.mono}>{abbreviateAddress(address)}</span> },
    { label: 'Réseau', value: network.name },
    { label: 'Quantité', value: formatCrypto(quantity, asset.symbol, { locale }) },
    { label: 'Frais réseau', value: formatCrypto(fee, asset.symbol, { locale }), hint: `≈ ${formatMoney(fee * price, { locale })}` },
    { label: 'Total débité', value: formatCrypto(totalDebit, asset.symbol, { locale }), strong: true },
    { label: 'Délai estimé', value: `≈ ${network.etaMinutes} min` },
  ]

  const steps: FlowStep[] = [
    {
      id: 'send-destination',
      title: 'Destination',
      validate: () => {
        /* The address and the network are one decision — an address is only valid *for* a
           network — so they share a screen, and the irreversibility warning is on it. */
        if (!address.trim()) {
          setAddressError('Entrez une adresse de destination.')
          return false
        }
        return !addressError
      },
      content: (
        <>
          {networks.length > 1 ? (
            <ChoiceList
              label="Réseau d’envoi"
              value={network.id}
              onChange={(v) => {
                setNetworkId(v)
                setAddressError(null)
                setEntryError(null)
              }}
              options={networks.map((n) => ({
                value: n.id,
                title: n.name,
                subtitle: `Frais ${formatCrypto(n.feeEstimate, asset.symbol, { locale })} · ~${n.etaMinutes} min`,
                label: `${n.name}, frais ${formatCrypto(n.feeEstimate, asset.symbol, { locale })}, environ ${n.etaMinutes} minutes`,
              }))}
            />
          ) : (
            <p className={styles.networkName}>{network.name}</p>
          )}
          <Callout icon="circle-alert" className={styles.networkWarning}>
            {network.warning}
          </Callout>
          <Field
            label={`Adresse ${network.name}`}
            hideLabel
            className={styles.address}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              if (addressError) setAddressError(null)
            }}
            placeholder={network.addressPrefix ? `${network.addressPrefix}…` : 'Adresse de destination'}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            error={addressError ?? undefined}
            warning={addressWarning ?? undefined}
            trailing={
              <span className={styles.addressActions}>
                <Button variant="ghost" onClick={() => void onPaste()}>
                  Coller
                </Button>
                <Button variant="ghost" iconOnly aria-label="Scanner un code QR" title="Caméra non disponible dans cette version" disabled className={styles.scan}>
                  <Icon name="scan" />
                </Button>
              </span>
            }
          />
        </>
      ),
    },
    {
      id: 'send-quantity',
      title: 'Quantité à envoyer',
      nextDisabled: !canContinue,
      content: (
        <AmountEntry
          label="Quantité à envoyer"
          value={raw}
          onChange={(v) => {
            setRaw(v)
            if (entryError) setEntryError(null)
          }}
          mode="crypto"
          unit={asset.symbol}
          secondary={quantity > 0 ? `≈ ${formatMoney(quantity * price, { locale })}` : holdings.data ? `Disponible : ${formatCrypto(held, asset.symbol, { locale })}` : undefined}
          error={shownEntryError}
          onMax={onMax}
          maxDecimals={decimals}
          disabled={previewM.pending}
        />
      ),
    },
    {
      id: 'send-review',
      title: 'Aperçu',
      content: (
        <ReviewList
          hero={formatCrypto(quantity, asset.symbol, { locale })}
          heroCaption={quantity > 0 ? `≈ ${formatMoney(quantity * price, { locale })}` : undefined}
          lines={lines}
          note="Les envois sont irréversibles. Vérifiez l’adresse et le réseau."
        />
      ),
    },
  ]

  return (
    <div className={cn('page', styles.send)}>
      <StepFlow
        title={`Envoyer ${asset.symbol}`}
        exit={`/crypto/${id}`}
        steps={steps}
        onFinish={() => void onContinue()}
        finishLabel="Envoyer"
        finishDisabled={!canContinue}
      />

      {preview ? (
        <ConfirmSheet
          open={sheetOpen}
          onClose={() => {
            if (sendM.pending) return
            setSheetOpen(false)
          }}
          title="Confirmer l'envoi"
          hero={formatCrypto(preview.quantity, asset.symbol, { locale })}
          heroCaption={`≈ ${formatMoney(preview.fiatValue, { locale })}`}
          lines={[
            { label: 'Destination', value: <span className={styles.mono}>{abbreviateAddress(address)}</span> },
            { label: 'Réseau', value: network.name },
            { label: 'Quantité', value: formatCrypto(preview.quantity, asset.symbol, { locale }) },
            { label: 'Frais réseau', value: formatCrypto(preview.networkFee, asset.symbol, { locale }), hint: `≈ ${formatMoney(preview.networkFee * price, { locale })}` },
            { label: 'Total débité', value: formatCrypto(preview.totalDebit, asset.symbol, { locale }), strong: true },
            { label: 'Délai', value: `≈ ${preview.etaMinutes} min` },
          ]}
          note="Les envois sont irréversibles. Vérifiez l'adresse et le réseau."
          confirmLabel="Envoyer"
          onConfirm={() => void onConfirm()}
          pending={sendM.pending}
          error={sendM.error}
        />
      ) : null}
    </div>
  )
}

/**
 * How a transaction's type and category are named in the interface.
 *
 * These are the product's vocabulary, not the mock's data — they belong to every
 * implementation of `KeewalApi` equally, and they used to live in `mock/seed.ts`. That
 * meant a build talking to a real back-end still pulled the entire invented dataset in
 * behind them: dead weight, and invented balances sitting in the same bundle as real ones.
 */
import type { TransactionCategory, TransactionType, TransferProvider } from './types'

export const TYPE_LABELS: Record<TransactionType, string> = {
  card: 'Paiement par carte',
  transfer_in: 'Virement reçu',
  transfer_out: 'Virement envoyé',
  etransfer_in: 'Transfert reçu',
  etransfer_out: 'Transfert envoyé',
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  interest: 'Intérêts',
  crypto_buy: 'Achat crypto',
  crypto_sell: 'Vente crypto',
  crypto_send: 'Envoi crypto',
  crypto_receive: 'Réception crypto',
  recurring_buy: 'Achat récurrent',
  refund: 'Remboursement',
  fee: 'Frais',
}

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  groceries: 'Épicerie',
  restaurants: 'Restaurants',
  transport: 'Transport',
  shopping: 'Achats',
  subscriptions: 'Abonnements',
  housing: 'Logement',
  utilities: 'Services',
  health: 'Santé',
  entertainment: 'Sorties',
  travel: 'Voyage',
  transfer: 'Virements',
  income: 'Revenus',
  savings: 'Épargne',
  crypto: 'Crypto',
  fees: 'Frais',
  other: 'Autre',
}

/** The four families of rail money can travel on, and what each one asks you for. */
export const TRANSFER_FAMILY_LABEL: Readonly<Record<TransferProvider['family'], string>> = {
  mobile_money: 'Mobile Money',
  wallet: 'Portefeuilles et néobanques',
  remittance: 'Espèces à retirer',
  bank: 'Virements bancaires',
}

export const TRANSFER_HANDLE_LABEL: Readonly<Record<TransferProvider['handle'], string>> = {
  phone: 'Numéro de téléphone',
  email: 'Adresse courriel',
  tag: 'Identifiant',
  account: 'Coordonnées du destinataire',
}

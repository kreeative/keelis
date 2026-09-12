/**
 * The single entry point for data access. Swap `mockApi` for a real client
 * implementing `KeewalApi` to connect a backend.
 */
import { mockApi, mockControls, PRICE_TICK_MS } from './mock/mockApi'
import type { KeewalApi } from './types'

export const api: KeewalApi = mockApi
export { mockControls, PRICE_TICK_MS }
export * from './types'
export { IDS, TYPE_LABELS, CATEGORY_LABELS } from './mock/seed'

/**
 * The single entry point for data access, and the one place that decides whether this app
 * is a demonstration or a product.
 *
 * Set `VITE_API_URL` and it talks to that backend through `rest/restApi`. Leave it unset
 * and it runs on `mock/`. **No screen knows which**, because both satisfy `KeewalApi` —
 * that was the point of writing the contract first, and it is what makes "brancher les
 * clés" a deployment change rather than a rewrite.
 *
 * There is deliberately no third mode where some domains are live and others are mocked.
 * A portfolio valued at live prices against holdings that are invented is not half-real,
 * it is wrong — and it is wrong in the way that looks right, which is worse. The app is
 * either connected or it is honest about not being.
 */
import { mockApi, PRICE_TICK_MS as MOCK_PRICE_TICK_MS } from './mock/mockApi'
import { createRestApi, REST_PRICE_TICK_MS } from './rest/restApi'
import { env } from '@/config/env'
import type { KeewalApi } from './types'

/**
 * The raw variable is tested here, not `env.apiUrl`, so that the choice is *statically*
 * decidable. Vite replaces `import.meta.env.VITE_API_URL` with a literal at build time, so
 * an unconfigured build folds to `mockApi` and drops the REST client, and a configured one
 * folds the other way and drops the mock — with it the whole invented dataset, which has no
 * business shipping in the same bundle as real balances. Testing anything the bundler
 * cannot fold (a validated value, a function call) would have shipped both.
 *
 * A configured-but-malformed URL therefore stays configured, and fails loudly. Falling
 * back to the demo data on a mistyped hostname is the one failure mode worth designing
 * against: the screens would fill with invented money that looks exactly like real money.
 */
const CONFIGURED = import.meta.env.VITE_API_URL

export const api: KeewalApi = CONFIGURED ? createRestApi({ baseUrl: env.apiUrl ?? CONFIGURED }) : mockApi

/** True when the numbers on screen come from a backend rather than the seed. */
export const isLive = !!CONFIGURED

export const PRICE_TICK_MS = CONFIGURED ? REST_PRICE_TICK_MS : MOCK_PRICE_TICK_MS

export * from './types'
/**
 * The interface's own vocabulary — no longer re-exported from the mock seed, which used to
 * drag the whole invented dataset into any build that showed a transaction label.
 *
 * `IDS` is deliberately *not* exported any more. It was the mock's account identifiers,
 * and a dozen screens looked accounts up by them; against a real back-end every one of
 * those lookups would have quietly found nothing. Accounts are found by `kind`
 * (`useAccount`, `useAccountId`), and ids belong to whoever is answering.
 */
export { TYPE_LABELS, CATEGORY_LABELS } from './labels'

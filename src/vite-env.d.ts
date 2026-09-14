/// <reference types="vite/client" />

/**
 * Every variable this app reads. They are all public — Vite inlines them into the shipped
 * bundle — so nothing secret may ever be added here. See `src/config/env.ts`.
 */
interface ImportMetaEnv {
  /** Back-end implementing the contract in `docs/API.md`. Unset → the app runs on the mock. */
  readonly VITE_API_URL?: string
  /** `hash` for the single-file demo, which has no server to route real paths. */
  readonly VITE_ROUTER?: string
}

/** Build timestamp, injected by vite.config.ts. */
declare const __BUILD_ID__: string

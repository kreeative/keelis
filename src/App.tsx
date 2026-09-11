import { BrowserRouter, HashRouter } from 'react-router-dom'
import { SettingsProvider } from '@/store/settings'
import { ToastProvider } from '@/store/toast'
import { SessionProvider } from '@/store/session'
import { DataProvider } from '@/store/data'
import { MarketProvider } from '@/store/market'
import { AppRoutes } from '@/shell/routes'

/** Hash routing is used for the single-file hosted demo (see vite.single.config.ts). */
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

export function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <SessionProvider>
          <DataProvider>
            <MarketProvider>
              <Router>
                <AppRoutes />
              </Router>
            </MarketProvider>
          </DataProvider>
        </SessionProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}

import { BrowserRouter } from 'react-router-dom'
import { SettingsProvider } from '@/store/settings'
import { ToastProvider } from '@/store/toast'
import { SessionProvider } from '@/store/session'
import { DataProvider } from '@/store/data'
import { MarketProvider } from '@/store/market'
import { AppRoutes } from '@/shell/routes'

export function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <SessionProvider>
          <DataProvider>
            <MarketProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </MarketProvider>
          </DataProvider>
        </SessionProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}

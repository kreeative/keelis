/**
 * Route map. Every feature page is lazy-loaded from src/features/<area>/.
 * French paths. Money flows: /fonds (add funds), /envoyer (send), crypto buy/sell under /crypto/:id.
 */
import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { RequireAuth, RequireAnonymous } from './guards'
import { PageFallback } from './PageFallback'
import { RouteBoundary } from './RouteBoundary'

/**
 * Retry a chunk that failed to arrive.
 *
 * Each screen is fetched the first time it is opened, and on a mobile connection that
 * request fails often enough to matter — a tunnel, a handover, a moment of no signal. Three
 * attempts with a widening gap turn most of those into nothing the user ever sees; what is
 * left reaches `RouteBoundary`, which keeps the navigation on screen instead of the app
 * vanishing into a white page.
 */
function retryImport<T>(loader: () => Promise<T>, attempts = 3, delay = 500): Promise<T> {
  return loader().catch((error: unknown) => {
    if (attempts <= 1) throw error
    return new Promise<void>((resolve) => setTimeout(resolve, delay)).then(() => retryImport(loader, attempts - 1, delay * 2))
  })
}

const L = (loader: () => Promise<{ default: ComponentType }>): LazyExoticComponent<ComponentType> => lazy(() => retryImport(loader))

// Home
const HomePage = L(() => import('@/features/home/HomePage'))
const ActivityPage = L(() => import('@/features/home/ActivityPage'))
// Crypto
const CryptoListPage = L(() => import('@/features/crypto/CryptoListPage'))
const AssetDetailPage = L(() => import('@/features/crypto/AssetDetailPage'))
const TradePage = lazy(() => import('@/features/crypto/TradePage'))
const CryptoSendPage = L(() => import('@/features/crypto/CryptoSendPage'))
const CryptoReceivePage = L(() => import('@/features/crypto/CryptoReceivePage'))
const RecurringPage = L(() => import('@/features/crypto/RecurringPage'))
// Checking
const CheckingPage = L(() => import('@/features/checking/CheckingPage'))
const TransactionDetailPage = L(() => import('@/features/checking/TransactionDetailPage'))
const AccountDetailsPage = L(() => import('@/features/checking/AccountDetailsPage'))
const SendMoneyPage = L(() => import('@/features/checking/SendMoneyPage'))
const TransferProvidersPage = L(() => import('@/features/checking/TransferProvidersPage'))
// Change
const ConvertPage = L(() => import('@/features/fx/ConvertPage'))
// Savings
const SavingsPage = L(() => import('@/features/savings/SavingsPage'))
const SavingsMovePage = lazy(() => import('@/features/savings/SavingsMovePage'))
const GoalPage = L(() => import('@/features/savings/GoalPage'))
// Funds
const AddFundsPage = L(() => import('@/features/funds/AddFundsPage'))
const FundsStatusPage = L(() => import('@/features/funds/FundsStatusPage'))
// Profile
const ProfilePage = L(() => import('@/features/profile/ProfilePage'))
const SecurityPage = L(() => import('@/features/profile/SecurityPage'))
const NotificationPrefsPage = L(() => import('@/features/profile/NotificationPrefsPage'))
const DocumentsPage = L(() => import('@/features/profile/DocumentsPage'))
const TaxPage = L(() => import('@/features/profile/TaxPage'))
const HelpPage = L(() => import('@/features/profile/HelpPage'))
const DataSourcePage = L(() => import('@/features/profile/DataSourcePage'))
const NotificationsPage = L(() => import('@/features/notifications/NotificationsPage'))
// Marketing
const CompanyPage = L(() => import('@/features/marketing/CompanyPage'))
// Onboarding
const WelcomePage = L(() => import('@/features/onboarding/WelcomePage'))
const OnboardingPage = L(() => import('@/features/onboarding/OnboardingPage'))
// System
const ComponentsGallery = L(() => import('@/features/system/ComponentsGallery'))
const NotFoundPage = L(() => import('@/features/system/NotFoundPage'))

export function AppRoutes() {
  return (
    /* The public routes live outside AppShell, so they get their own boundary: a failed
       chunk on /bienvenue or /entreprise would otherwise be the same white page. */
    <RouteBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
        {/* Public */}
        <Route element={<RequireAnonymous />}>
          <Route path="/bienvenue" element={<WelcomePage />} />
          <Route path="/inscription/*" element={<OnboardingPage />} />
        </Route>

        {/* The company page is outside both guards on purpose: a page that redirects a
            signed-in visitor to their dashboard is a page nobody can link to. */}
        <Route path="/entreprise" element={<CompanyPage />} />

        {/* Dev: component library with all states */}
        <Route path="/composants" element={<ComponentsGallery />} />

        {/* App */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="/activite" element={<ActivityPage />} />

            <Route path="/crypto" element={<CryptoListPage />} />
            <Route path="/crypto/recurrents" element={<RecurringPage />} />
            <Route path="/crypto/:id" element={<AssetDetailPage />} />
            <Route path="/crypto/:id/acheter" element={<TradePage side="buy" />} />
            <Route path="/crypto/:id/vendre" element={<TradePage side="sell" />} />
            <Route path="/crypto/:id/envoyer" element={<CryptoSendPage />} />
            <Route path="/crypto/:id/recevoir" element={<CryptoReceivePage />} />

            <Route path="/carte" element={<CheckingPage />} />
            <Route path="/carte/details" element={<AccountDetailsPage />} />
            <Route path="/carte/transactions/:id" element={<TransactionDetailPage />} />
            <Route path="/transactions/:id" element={<TransactionDetailPage />} />
            <Route path="/envoyer" element={<SendMoneyPage />} />
            <Route path="/envoyer/operateurs" element={<TransferProvidersPage />} />
            <Route path="/convertir" element={<ConvertPage />} />

            <Route path="/epargne" element={<SavingsPage />} />
            <Route path="/epargne/deposer" element={<SavingsMovePage direction="deposit" />} />
            <Route path="/epargne/retirer" element={<SavingsMovePage direction="withdraw" />} />
            <Route path="/epargne/objectifs/nouveau" element={<GoalPage />} />
            <Route path="/epargne/objectifs/:id" element={<GoalPage />} />

            <Route path="/fonds" element={<AddFundsPage />} />
            <Route path="/fonds/statut/:txId" element={<FundsStatusPage />} />

            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/profil/securite" element={<SecurityPage />} />
            <Route path="/profil/notifications" element={<NotificationPrefsPage />} />
            <Route path="/profil/documents" element={<DocumentsPage />} />
            <Route path="/profil/fiscalite" element={<TaxPage />} />
            <Route path="/profil/aide" element={<HelpPage />} />
            <Route path="/profil/donnees" element={<DataSourcePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route path="/accueil" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </RouteBoundary>
  )
}

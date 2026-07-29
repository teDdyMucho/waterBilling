import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { I18nProvider } from '@/i18n/I18nProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { PwaManager } from '@/features/pwa/PwaManager'
import {
  PublicOnly,
  RequireAuth,
  RoleGuard,
  StatusRoute,
} from '@/features/auth/guards'

import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import PendingPage from '@/pages/auth/PendingPage'
import BlockedPage from '@/pages/auth/BlockedPage'
import HomeownerHome from '@/pages/portal/HomeownerHome'
import { HomeownerBills, HomeownerBillDetail } from '@/pages/portal/HomeownerBills'
// Lazy — recharts ay mabigat; huwag isama sa initial bundle.
const HomeownerConsumption = lazy(() => import('@/pages/portal/HomeownerConsumption'))
import HomeownerProfile from '@/pages/portal/HomeownerProfile'
import HomeownerMessages from '@/pages/portal/HomeownerMessages'
import HomeownerPay from '@/pages/portal/HomeownerPay'
import HomeownerPayments from '@/pages/portal/HomeownerPayments'
import AdminRates from '@/pages/portal/AdminRates'
import AdminPaymentSettings from '@/pages/portal/AdminPaymentSettings'
import AdminReports from '@/pages/portal/AdminReports'
import AdminAudit from '@/pages/portal/AdminAudit'
import { StaffConcerns, AdminConcerns } from '@/pages/portal/StaffConcerns'
import { StaffPayments, AdminPayments } from '@/pages/portal/PaymentQueue'
import StaffHome from '@/pages/portal/StaffHome'
import AdminHome from '@/pages/portal/AdminHome'
import AdminAccounts from '@/pages/portal/AdminAccounts'
import { AdminProperties, AdminPropertyDetail } from '@/pages/portal/AdminProperties'
import { StaffProperties, StaffPropertyDetail } from '@/pages/portal/StaffProperties'
import AdminCycles from '@/pages/portal/AdminCycles'
import AdminReview from '@/pages/portal/AdminReview'
import StaffWorklist from '@/pages/portal/StaffWorklist'
import StaffBills from '@/pages/portal/StaffBills'
import NotFoundPage from '@/pages/NotFoundPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AuthProvider>
            <PwaManager />
            <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />

              {/* Auth forms — itatapon ang naka-login na sa tamang lugar */}
              <Route element={<PublicOnly />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>

              {/* Reset — kailangan ng recovery session mula sa email link */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Status screens */}
              <Route element={<StatusRoute expect="pending" />}>
                <Route path="/pending" element={<PendingPage />} />
              </Route>
              <Route element={<StatusRoute expect="blocked" />}>
                <Route path="/blocked" element={<BlockedPage />} />
              </Route>

              {/* Protektadong app (active na account lang) */}
              <Route element={<RequireAuth />}>
                <Route element={<RoleGuard allow={['homeowner']} />}>
                  <Route path="/dashboard" element={<HomeownerHome />} />
                  <Route path="/dashboard/bills" element={<HomeownerBills />} />
                  <Route path="/dashboard/bills/:id" element={<HomeownerBillDetail />} />
                  <Route
                    path="/dashboard/consumption"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <HomeownerConsumption />
                      </Suspense>
                    }
                  />
                  <Route path="/dashboard/profile" element={<HomeownerProfile />} />
                  <Route path="/dashboard/messages" element={<HomeownerMessages />} />
                  <Route path="/dashboard/messages/:id" element={<HomeownerMessages />} />
                  <Route path="/dashboard/payments" element={<HomeownerPayments />} />
                  <Route path="/dashboard/pay/:billId" element={<HomeownerPay />} />
                </Route>
                <Route element={<RoleGuard allow={['staff']} />}>
                  <Route path="/staff" element={<StaffHome />} />
                  <Route path="/staff/properties" element={<StaffProperties />} />
                  <Route path="/staff/properties/:id" element={<StaffPropertyDetail />} />
                  <Route path="/staff/readings" element={<StaffWorklist />} />
                  <Route path="/staff/bills" element={<StaffBills />} />
                  <Route path="/staff/bills/:id" element={<StaffBills />} />
                  <Route path="/staff/concerns" element={<StaffConcerns />} />
                  <Route path="/staff/concerns/:id" element={<StaffConcerns />} />
                  <Route path="/staff/payments" element={<StaffPayments />} />
                </Route>
                <Route element={<RoleGuard allow={['admin']} />}>
                  <Route path="/admin" element={<AdminHome />} />
                  <Route path="/admin/accounts" element={<AdminAccounts />} />
                  <Route path="/admin/properties" element={<AdminProperties />} />
                  <Route path="/admin/properties/:id" element={<AdminPropertyDetail />} />
                  <Route path="/admin/cycles" element={<AdminCycles />} />
                  <Route path="/admin/review" element={<AdminReview />} />
                  <Route path="/admin/rates" element={<AdminRates />} />
                  <Route path="/admin/concerns" element={<AdminConcerns />} />
                  <Route path="/admin/concerns/:id" element={<AdminConcerns />} />
                  <Route path="/admin/payments" element={<AdminPayments />} />
                  <Route path="/admin/payment-settings" element={<AdminPaymentSettings />} />
                  <Route path="/admin/reports" element={<AdminReports />} />
                  <Route path="/admin/audit" element={<AdminAudit />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

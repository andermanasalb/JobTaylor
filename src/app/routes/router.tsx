import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/shared/components/layout/AppShell'
import { SearchPage } from '@/features/job-postings/ui/pages/SearchPage'
import { JobPostingEditorPage } from '@/features/job-postings/ui/pages/JobPostingEditorPage'
import { CvBasePage } from '@/features/cv-base/ui/pages/CvBasePage'
import { HistoryPage } from '@/features/history/ui/pages/HistoryPage'
import { SettingsPage } from '@/features/settings/ui/pages/SettingsPage'
import { TailorPage } from '@/features/tailoring/ui/pages/TailorPage'
import { LoginPage } from '@/features/auth/ui/pages/LoginPage'
import { ProtectedRoute } from '@/features/auth/ui/components/ProtectedRoute'
import { AuthProvider } from '@/features/auth/ui/context/AuthContext'

/** Root layout: provides AuthContext to all routes (public + private). */
function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export const router = createBrowserRouter([
  {
    // Root layout — provides AuthContext to every route below
    element: <AuthRoot />,
    children: [
      // ── Public routes ──────────────────────────────────────────────────────
      {
        path: '/login',
        element: <LoginPage />,
      },

      // ── Private routes (require auth) ──────────────────────────────────────
      {
        path: '/',
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/search" replace /> },
              { path: 'search', element: <SearchPage /> },
              { path: 'jobs/new', element: <JobPostingEditorPage /> },
              { path: 'jobs/:id', element: <JobPostingEditorPage /> },
              { path: 'cv', element: <CvBasePage /> },
              { path: 'history', element: <HistoryPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'tailor/:jobId', element: <TailorPage /> },
            ],
          },
        ],
      },
    ],
  },
])


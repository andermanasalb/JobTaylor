import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/routes/router'
import { AppDepsProvider } from '@/app/AppDepsContext'
import { ThemeProvider } from '@/shared/context/ThemeContext'
import { GenerationQueueProvider } from '@/shared/context/GenerationQueueContext'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import '@/shared/i18n/i18n'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AppDepsProvider>
          <GenerationQueueProvider>
            <RouterProvider router={router} />
          </GenerationQueueProvider>
        </AppDepsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
)

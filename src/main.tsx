import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/routes/router'
import { AppDepsProvider } from '@/app/AppDepsContext'
import { ThemeProvider } from '@/shared/context/ThemeContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppDepsProvider>
        <RouterProvider router={router} />
      </AppDepsProvider>
    </ThemeProvider>
  </StrictMode>
)

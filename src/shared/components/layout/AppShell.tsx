import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Search, FileText, History, Settings, Scissors, Menu, X, LogOut, Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { useTheme } from '@/shared/context/ThemeContext'
import { useAuth } from '@/features/auth/ui/context/AuthContext'
import { useAuthRepository } from '@/app/AppDepsContext'


export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const { session } = useAuth()
  const authRepository = useAuthRepository()
  const { t } = useTranslation()

  const navItems = [
    { to: '/search', label: t('nav.search'), icon: Search },
    { to: '/cv', label: t('nav.cv'), icon: FileText },
    { to: '/history', label: t('nav.history'), icon: History },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
  ]

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  function isActive(to: string) {
    return location.pathname === to || location.pathname.startsWith(to + '/')
  }

  async function handleLogout() {
    await authRepository.signOut()
    localStorage.clear()
    navigate('/login', { replace: true })
  }

  // Avatar: first letter of email, uppercased
  const avatarLetter = session?.user.email?.[0]?.toUpperCase() ?? '?'
  const emailDisplay = session?.user.email ?? ''

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Scissors className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
            JobTaylor
          </span>
        </div>

        <nav className="flex-1 px-3 py-2" aria-label="Main navigation">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                    isActive(item.to)
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                  aria-current={isActive(item.to) ? 'page' : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-border px-3 py-3 space-y-1">
          {/* User avatar + email */}
          <div className="flex items-center gap-2 px-3 py-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {avatarLetter}
            </div>
            <span className="truncate text-xs text-muted-foreground" title={emailDisplay}>
              {emailDisplay}
            </span>
          </div>
          {/* Theme toggle + logout */}
          <div className="flex items-center justify-between px-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={toggleTheme}
              aria-label={resolvedTheme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
              aria-label={t('logout')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
              className="h-8 w-8"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Scissors className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-base font-semibold text-foreground">JobTaylor</span>
            </div>
          </div>
        </header>

        {/* Mobile Nav Overlay */}
        {mobileOpen && (
          <div className="absolute inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-foreground/20"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <nav
              className="absolute left-0 top-0 h-full w-64 bg-sidebar p-4 shadow-lg"
              aria-label="Mobile navigation"
            >
              <div className="flex items-center gap-2 mb-6 mt-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Scissors className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-semibold text-sidebar-foreground">JobTaylor</span>
              </div>
              <ul className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive(item.to)
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                      aria-current={isActive(item.to) ? 'page' : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-border pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-3 px-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={toggleTheme}
                >
                  {resolvedTheme === 'dark'
                    ? <><Sun className="h-4 w-4 shrink-0" /> {t('theme.lightMode')}</>
                    : <><Moon className="h-4 w-4 shrink-0" /> {t('theme.darkMode')}</>
                  }
                </Button>
              </div>
            </nav>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

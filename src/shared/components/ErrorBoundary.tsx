import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// ── Fallback UI (function component → can use hooks) ──────────────────────────

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl" aria-hidden="true">⚠️</span>
        <h1 className="text-2xl font-semibold">{t('error.title')}</h1>
        <p className="text-muted-foreground max-w-md text-sm">{t('error.description')}</p>
        {error && (
          <pre className="bg-muted mt-2 max-w-md overflow-auto rounded p-3 text-left text-xs">
            {error.message}
          </pre>
        )}
      </div>
      <button
        onClick={onReset}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4 py-2 text-sm font-medium transition-colors"
      >
        {t('error.goHome')}
      </button>
    </div>
  )
}

// ── Error Boundary (class component — required by React) ──────────────────────

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      )
    }
    return this.props.children
  }
}

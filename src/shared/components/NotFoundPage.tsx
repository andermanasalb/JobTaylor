import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-muted-foreground text-8xl font-bold">404</span>
        <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
        <p className="text-muted-foreground max-w-md text-sm">{t('notFound.description')}</p>
      </div>
      <Link
        to="/search"
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4 py-2 text-sm font-medium transition-colors"
      >
        {t('notFound.goHome')}
      </Link>
    </div>
  )
}

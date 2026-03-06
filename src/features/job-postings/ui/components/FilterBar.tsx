import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import { Label } from '@/shared/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { Checkbox } from '@/shared/components/ui/checkbox'

interface FilterBarProps {
  query: string
  onQueryChange: (q: string) => void
  /** Locations derived from the current API results — used to populate the popover. */
  availableLocations: string[]
  selectedLocations: string[]
  onLocationsChange: (locs: string[]) => void
  remoteOnly: boolean
  onRemoteOnlyChange: (v: boolean) => void
  onClear: () => void
  onSearch?: () => void
}

export function FilterBar({
  query,
  onQueryChange,
  availableLocations,
  selectedLocations,
  onLocationsChange,
  remoteOnly,
  onRemoteOnlyChange,
  onClear,
  onSearch,
}: FilterBarProps) {
  const { t } = useTranslation()
  const hasFilters = Boolean(query) || selectedLocations.length > 0 || remoteOnly

  function toggleLocation(loc: string) {
    if (selectedLocations.includes(loc)) {
      onLocationsChange(selectedLocations.filter(l => l !== loc))
    } else {
      onLocationsChange([...selectedLocations, loc])
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('filter.placeholder')}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch?.()}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {onSearch && (
          <Button size="sm" className="h-9 px-3 text-xs" onClick={onSearch}>
            {t('filter.search')}
          </Button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Location multi-select — triggers an API search per selected location */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
              {t('filter.location')}
              {selectedLocations.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                  {selectedLocations.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            {availableLocations.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('filter.noLocations')}</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {availableLocations.map(loc => (
                  <label key={loc} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedLocations.includes(loc)}
                      onCheckedChange={() => toggleLocation(loc)}
                    />
                    <span className="truncate">{loc}</span>
                  </label>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Remote toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="remote-toggle"
            checked={remoteOnly}
            onCheckedChange={onRemoteOnlyChange}
            className="scale-75"
          />
          <Label htmlFor="remote-toggle" className="text-xs cursor-pointer">
            {t('filter.remoteOnly')}
          </Label>
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={onClear}
          >
            <X className="h-3 w-3 mr-1" />
            {t('filter.clear')}
          </Button>
        )}
      </div>
    </div>
  )
}

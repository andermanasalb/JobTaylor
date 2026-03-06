import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { Checkbox } from '@/shared/components/ui/checkbox'
import type { WorkMode } from '../types/SearchListing'

const WORK_MODES: WorkMode[] = ['Remote', 'Hybrid', 'On-site']

interface FilterBarProps {
  query: string
  onQueryChange: (q: string) => void
  // Ubicaciones disponibles derivadas de los resultados actuales
  availableLocations: string[]
  selectedLocations: string[]
  onLocationsChange: (locs: string[]) => void
  workMode: WorkMode | 'all'
  onWorkModeChange: (wm: WorkMode | 'all') => void
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
  workMode,
  onWorkModeChange,
  remoteOnly,
  onRemoteOnlyChange,
  onClear,
  onSearch,
}: FilterBarProps) {
  const { t } = useTranslation()
  const hasFilters = query || selectedLocations.length > 0 || remoteOnly || workMode !== 'all'

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
        {/* Ubicación multi-select dinámico */}
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

        {/* Modalidad de trabajo */}
        <Select
          value={workMode}
          onValueChange={v => onWorkModeChange(v as WorkMode | 'all')}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Modalidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter.allModes')}</SelectItem>
            {WORK_MODES.map(wm => (
              <SelectItem key={wm} value={wm}>{t(`filter.workMode.${wm}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Remote toggle — acceso rápido */}
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

        {/* Limpiar filtros */}
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

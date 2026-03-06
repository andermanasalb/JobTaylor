import { useState } from 'react'
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
  /** Locations derived from the current API results — used as suggestions. */
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
  const [open, setOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')

  const hasFilters = Boolean(query) || selectedLocations.length > 0 || remoteOnly

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (!isOpen) setLocationSearch('')
  }

  function toggleLocation(loc: string) {
    if (selectedLocations.includes(loc)) {
      onLocationsChange(selectedLocations.filter(l => l !== loc))
    } else {
      onLocationsChange([...selectedLocations, loc])
    }
  }

  const searchTrimmed = locationSearch.trim()

  // Suggestions from the pool filtered by the typed text (excluding already selected)
  const filteredSuggestions = availableLocations.filter(
    loc =>
      !selectedLocations.includes(loc) &&
      loc.toLowerCase().includes(searchTrimmed.toLowerCase()),
  )

  // True when the typed text doesn't match any existing option (neither selected nor in pool)
  const isNewCity =
    searchTrimmed.length > 0 &&
    !availableLocations.some(loc => loc.toLowerCase() === searchTrimmed.toLowerCase()) &&
    !selectedLocations.some(loc => loc.toLowerCase() === searchTrimmed.toLowerCase())

  function handleAddFreeText() {
    if (!searchTrimmed) return
    onLocationsChange([...selectedLocations, searchTrimmed])
    setLocationSearch('')
  }

  function handleLocationKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredSuggestions.length === 1) {
        toggleLocation(filteredSuggestions[0])
        setLocationSearch('')
      } else if (isNewCity) {
        handleAddFreeText()
      }
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
        {/* Location combobox — free text + suggestions from results pool */}
        <Popover open={open} onOpenChange={handleOpenChange}>
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
            <div className="flex flex-col gap-2">
              {/* Free-text input */}
              <Input
                placeholder={t('filter.typeCity')}
                value={locationSearch}
                onChange={e => setLocationSearch(e.target.value)}
                onKeyDown={handleLocationKeyDown}
                className="h-8 text-sm"
                autoFocus
              />

              <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                {/* Already selected cities — always visible at the top */}
                {selectedLocations.map(loc => (
                  <label key={loc} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={true}
                      onCheckedChange={() => toggleLocation(loc)}
                    />
                    <span className="truncate flex-1">{loc}</span>
                  </label>
                ))}

                {/* Divider between selected and suggestions */}
                {selectedLocations.length > 0 && filteredSuggestions.length > 0 && (
                  <div className="border-t border-border my-1" />
                )}

                {/* Filtered suggestions from the pool */}
                {filteredSuggestions.map(loc => (
                  <label key={loc} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => toggleLocation(loc)}
                    />
                    <span className="truncate">{loc}</span>
                  </label>
                ))}

                {/* Free-text add option when the typed city is not in the pool */}
                {isNewCity && (
                  <button
                    className="text-left text-sm text-primary hover:underline px-1 py-0.5 mt-1"
                    onClick={handleAddFreeText}
                  >
                    + {t('filter.addCity', { city: searchTrimmed })}
                  </button>
                )}

                {/* Empty state: nothing selected, no suggestions, no free text */}
                {!isNewCity && filteredSuggestions.length === 0 && selectedLocations.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">{t('filter.typeCity')}</p>
                )}
              </div>
            </div>
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

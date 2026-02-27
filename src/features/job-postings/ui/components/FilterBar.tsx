import { Search, X } from 'lucide-react'
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
import type { Region, Seniority } from '../types/SearchListing'

const REGIONS: Region[] = ['País Vasco', 'Madrid', 'Barcelona', 'Remote (EU)']
const SENIORITY_LEVELS: Seniority[] = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal']

interface FilterBarProps {
  query: string
  onQueryChange: (q: string) => void
  selectedRegions: Region[]
  onRegionsChange: (r: Region[]) => void
  remoteOnly: boolean
  onRemoteOnlyChange: (v: boolean) => void
  seniority: Seniority | 'all'
  onSeniorityChange: (s: Seniority | 'all') => void
  onClear: () => void
}

export function FilterBar({
  query,
  onQueryChange,
  selectedRegions,
  onRegionsChange,
  remoteOnly,
  onRemoteOnlyChange,
  seniority,
  onSeniorityChange,
  onClear,
}: FilterBarProps) {
  const hasFilters = query || selectedRegions.length > 0 || remoteOnly || seniority !== 'all'

  function toggleRegion(region: Region) {
    if (selectedRegions.includes(region)) {
      onRegionsChange(selectedRegions.filter(r => r !== region))
    } else {
      onRegionsChange([...selectedRegions, region])
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by role, title, or keyword..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Region multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
              Region
              {selectedRegions.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                  {selectedRegions.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="start">
            <div className="flex flex-col gap-2">
              {REGIONS.map(region => (
                <label key={region} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedRegions.includes(region)}
                    onCheckedChange={() => toggleRegion(region)}
                  />
                  {region}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Seniority select */}
        <Select
          value={seniority}
          onValueChange={v => onSeniorityChange(v as Seniority | 'all')}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Seniority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {SENIORITY_LEVELS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Remote toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="remote-toggle"
            checked={remoteOnly}
            onCheckedChange={onRemoteOnlyChange}
            className="scale-75"
          />
          <Label htmlFor="remote-toggle" className="text-xs cursor-pointer">
            Remote only
          </Label>
        </div>

        {/* Clear all */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={onClear}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

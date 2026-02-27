import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { validatePassword } from '@/features/auth/domain/validatePassword'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  showRequirements?: boolean
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  /** aria-label for the input (default: "Contraseña") */
  ariaLabel?: string
}

const RULES = [
  'Mínimo 12 caracteres',
  'Al menos una mayúscula',
  'Al menos una minúscula',
  'Al menos un número',
  'Al menos un carácter especial',
]

const STRENGTH_LABEL: Record<string, string> = {
  weak:   'Débil',
  medium: 'Media',
  strong: 'Fuerte',
}

const STRENGTH_COLOR: Record<string, string> = {
  weak:   'bg-destructive',
  medium: 'bg-yellow-500',
  strong: 'bg-green-500',
}

const STRENGTH_WIDTH: Record<string, string> = {
  weak:   'w-1/3',
  medium: 'w-2/3',
  strong: 'w-full',
}

export function PasswordInput({
  value,
  onChange,
  showRequirements = false,
  placeholder = 'Contraseña',
  autoComplete = 'current-password',
  disabled = false,
  ariaLabel = 'Contraseña',
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  const validation = validatePassword(value)
  const failingErrors = new Set(validation.errors)

  return (
    <div className="flex flex-col gap-2">
      {/* Input row */}
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="pl-9 pr-9"
          required
          autoComplete={autoComplete}
          aria-label={ariaLabel}
          disabled={disabled}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShow(v => !v)}
          aria-label={show ? 'Ocultar' : 'Mostrar'}
          disabled={disabled}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Requirements + strength bar */}
      {showRequirements && (
        <div className="flex flex-col gap-1.5">
          {/* Strength bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                data-strength={validation.strength}
                className={`h-full rounded-full transition-all ${STRENGTH_COLOR[validation.strength]} ${STRENGTH_WIDTH[validation.strength]}`}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right">
              {value.length > 0 ? STRENGTH_LABEL[validation.strength] : ''}
            </span>
          </div>

          {/* Rule list */}
          <ul className="flex flex-col gap-0.5">
            {RULES.map(rule => {
              const passes = !failingErrors.has(rule)
              return (
                <li
                  key={rule}
                  data-rule-status={passes ? 'pass' : 'fail'}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${
                    passes ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                  }`}
                >
                  <span aria-hidden="true">{passes ? '✓' : '✗'}</span>
                  {rule}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

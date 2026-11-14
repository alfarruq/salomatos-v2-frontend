import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { useFieldControl } from './Field'

export type SelectSize = 'sm' | 'md'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** `sm` is the dense variant for tables and toolbars (§13 data density). */
  size?: SelectSize
  disabled?: boolean
  name?: string
  id?: string
  /** Names the trigger where no visible `Field` label fits, e.g. a table cell. */
  'aria-label'?: string
  /** A decorative icon before the value, so a toolbar of selects reads at a glance. */
  icon?: ReactNode
  className?: string
}

const sizes: Record<SelectSize, string> = {
  sm: 'h-8 px-3 text-callout pointer-coarse:min-h-11',
  md: 'h-11 px-4 text-body',
}

function Item({ option }: { option: SelectOption }): ReactNode {
  return (
    <SelectPrimitive.Item
      value={option.value}
      disabled={option.disabled ?? false}
      className={cn(
        'relative flex cursor-default items-center gap-2 rounded-[8px] py-2 pr-8 pl-3',
        'text-body text-text outline-none select-none',
        // Radix drives highlight from keyboard and pointer alike, so arrow keys
        // and the mouse produce the same visual state.
        'data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent-text',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      )}
    >
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-3">
        <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  size = 'md',
  disabled,
  name,
  id,
  'aria-label': ariaLabel,
  icon,
  className,
}: SelectProps) {
  const field = useFieldControl()

  /*
   * Whenever a `<form>` ancestor is present — always, here — Radix renders a
   * hidden native <select> for plain HTML form submission. That native
   * element only gets its <option>s once each item has actually mounted,
   * which for a closed select never happened yet; assigning it a value with
   * no matching option makes the browser reset it to "", and Radix bubbles
   * that reset back through `onValueChange('')`. No option in this app is
   * ever legitimately `''` — that always means "nothing chosen" — so this is
   * safe to treat as the native-select artefact it is, not a real change.
   */
  const handleValueChange = (next: string) => {
    if (next === '') return
    onValueChange?.(next)
  }

  return (
    <SelectPrimitive.Root
      {...(value === undefined ? {} : { value })}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(onValueChange === undefined ? {} : { onValueChange: handleValueChange })}
      {...(name === undefined ? {} : { name })}
      disabled={disabled ?? false}
    >
      <SelectPrimitive.Trigger
        id={id ?? field?.controlId}
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.isInvalid ?? undefined}
        className={cn(
          // Left-aligned and one line: a button centres and wraps a long label by default.
          'flex w-full items-center justify-between gap-2 text-left',
          'rounded-control border border-border bg-sunken text-text',
          'transition-[border-color] duration-150 ease-out-apple',
          'hover:border-border-strong',
          'disabled:pointer-events-none disabled:opacity-40',
          'aria-invalid:border-danger',
          // Placeholder uses the secondary level — tertiary does not reach AA
          // on the sunken background.
          'data-[placeholder]:text-text-secondary',
          sizes[size],
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 [&>span:last-child]:truncate">
          {icon === undefined ? null : (
            <span aria-hidden="true" className="shrink-0 text-text-secondary">
              {icon}
            </span>
          )}
          <SelectPrimitive.Value placeholder={placeholder}>
            {options.find((option) => option.value === value)?.label}
          </SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
            'rounded-card border border-border bg-elevated p-1 shadow-popover',
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <Item key={option.value} option={option} />
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

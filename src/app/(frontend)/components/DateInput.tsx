'use client'

import type { InputHTMLAttributes, KeyboardEvent, MouseEvent } from 'react'

/*
 * A native date input that opens its calendar from anywhere in the
 * field, not just the small calendar icon.
 *
 * - Mouse and touch: click or tap anywhere in the field.
 * - Keyboard: Enter or Alt+ArrowDown opens it; typing a date by hand
 *   and tabbing through the field work as normal (focus alone never
 *   pops the calendar open).
 * - Browsers without showPicker() keep their built-in behaviour.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

function openPicker(input: HTMLInputElement) {
  if (input.disabled || input.readOnly || typeof input.showPicker !== 'function') return

  try {
    input.showPicker()
  } catch {
    // Not allowed without a user gesture, or already open: ignore.
  }
}

export function DateInput({ onClick, onKeyDown, className, ...props }: Props) {
  return (
    <input
      {...props}
      type="date"
      className={['date-input', className].filter(Boolean).join(' ')}
      onClick={(event: MouseEvent<HTMLInputElement>) => {
        onClick?.(event)
        if (!event.defaultPrevented) openPicker(event.currentTarget)
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(event)

        if (event.defaultPrevented) return

        if (event.key === 'Enter' || (event.altKey && event.key === 'ArrowDown')) {
          // Enter would otherwise submit the whole form.
          event.preventDefault()
          openPicker(event.currentTarget)
        }
      }}
    />
  )
}

import type { ChangeEvent } from 'react'

const DIGIT = /\d/

function digitsIn(text: string): string {
  return text.replace(/\D/g, '')
}

function countDigits(text: string): number {
  let count = 0
  for (const char of text) if (DIGIT.test(char)) count += 1
  return count
}

/** Index just after the `count`-th digit of `text`: where a caret sitting behind that digit belongs. */
export function caretAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let index = 0; index < text.length; index += 1) {
    if (DIGIT.test(text.charAt(index))) {
      seen += 1
      if (seen === count) return index + 1
    }
  }
  return text.length
}

export interface MaskedEdit {
  /** The raw text the browser produced for this keystroke or paste. */
  raw: string
  /** Caret position inside `raw`. */
  caret: number
  /** What the field showed before the edit. */
  previous: string
  /** `InputEvent.inputType`, when the browser reports one. */
  inputType?: string | undefined
}

/**
 * Applies a mask to one edit and works out where the caret goes.
 *
 * The caret is tracked by how many digits sit before it, not by its index: the
 * separators move around as the mask regroups, the digits the user is looking
 * at do not. Without this, a controlled input that rewrites its value sends
 * the caret to the end, so fixing one digit in the middle of a number appends
 * the new digit after the last one instead.
 */
export function applyMask(
  { raw, caret, previous, inputType }: MaskedEdit,
  format: (raw: string) => string,
): { display: string; caret: number } {
  let text = raw
  let at = caret

  // Deleting only a separator would be undone by the mask on the spot, so the
  // key would look dead. Delete the digit the user was aiming at instead.
  // The digits must be the very same ones: pasting "100000" over "350,000" is
  // one character shorter with as many digits, and must not lose a digit.
  const removedSeparatorOnly =
    raw.length === previous.length - 1 && digitsIn(raw) === digitsIn(previous) && raw !== ''
  if (removedSeparatorOnly) {
    if (inputType === 'deleteContentForward') {
      const next = raw.slice(at).search(DIGIT)
      if (next !== -1) text = raw.slice(0, at) + raw.slice(at + next + 1)
    } else {
      let before = at - 1
      while (before >= 0 && !DIGIT.test(raw.charAt(before))) before -= 1
      if (before >= 0) {
        text = raw.slice(0, before) + raw.slice(before + 1)
        at = before
      }
    }
  }

  const display = format(text)

  // A digit typed into a field that is already full would push the last digit
  // out of the mask unseen. Refuse the keystroke instead, like `maxLength` does.
  const typedOneDigit =
    raw.length === previous.length + 1 && countDigits(raw) > countDigits(previous)
  if (typedOneDigit && countDigits(display) <= countDigits(previous)) {
    return {
      display: previous,
      caret: caretAfterDigits(previous, countDigits(raw.slice(0, at)) - 1),
    }
  }

  return { display, caret: caretAfterDigits(display, countDigits(text.slice(0, at))) }
}

/**
 * The `onChange` half of a masked input: formats the edit, writes it to the
 * field and puts the caret back where the user was typing.
 *
 * Writing the value here, before React re-renders, is deliberate. When the
 * mask rejects an edit (a tenth phone digit, say) the parent's value does not
 * change, React has nothing to re-render, and the caret would otherwise stay
 * wherever the browser left it.
 */
export function handleMaskedChange(
  event: ChangeEvent<HTMLInputElement>,
  previous: string,
  format: (raw: string) => string,
): string {
  const input = event.currentTarget
  const nativeEvent: Event = event.nativeEvent
  const { display, caret } = applyMask(
    {
      raw: input.value,
      caret: input.selectionStart ?? input.value.length,
      previous,
      inputType: nativeEvent instanceof InputEvent ? nativeEvent.inputType : undefined,
    },
    format,
  )
  if (input.value !== display) input.value = display
  if (input.ownerDocument.activeElement === input) input.setSelectionRange(caret, caret)
  return display
}

import { useEffect, useRef } from 'react'

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type DialogBehaviorProps = {
  /** Omit for dialogs that must be completed, such as the first-time currency choice. */
  onClose?: () => void
}

/** Renders nothing; render it inside a role="dialog" element to give it keyboard and focus handling. */
export function DialogBehavior({ onClose }: DialogBehaviorProps) {
  const anchor = useRef<HTMLSpanElement>(null)
  const closeRef = useRef(onClose)

  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const dialog = anchor.current?.closest<HTMLElement>('[role="dialog"]')
    if (!dialog) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus the dialog itself rather than a field so phones do not open the keyboard over the form.
    dialog.tabIndex = -1
    dialog.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (!dialog) return
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
      if (items.length === 0) { event.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!dialog.contains(active) || active === dialog) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  return <span ref={anchor} hidden />
}

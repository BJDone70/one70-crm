'use client'

import { useEffect } from 'react'

export default function KeyboardHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let keyboardOpen = false
    let spacerEl: HTMLDivElement | null = null

    // Create a spacer div that we'll use to push content up
    function ensureSpacer() {
      if (!spacerEl) {
        spacerEl = document.createElement('div')
        spacerEl.id = 'keyboard-spacer'
        spacerEl.style.cssText = 'height:0;transition:height 0.2s ease;pointer-events:none;'
        document.body.appendChild(spacerEl)
      }
      return spacerEl
    }

    function openKeyboard(height: number) {
      if (keyboardOpen && height === 0) return
      keyboardOpen = height > 0
      const spacer = ensureSpacer()
      spacer.style.height = height > 0 ? `${height}px` : '0'

      if (height > 0) {
        // Scroll focused element into view
        requestAnimationFrame(() => {
          const el = document.activeElement as HTMLElement
          if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            const rect = el.getBoundingClientRect()
            const viewHeight = window.visualViewport?.height || window.innerHeight
            // If the element is below the visible area
            if (rect.bottom > viewHeight - 20) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }
        })
      }
    }

    // Method 1: visualViewport API (works in modern browsers and many WebViews)
    function onViewportResize() {
      const vv = window.visualViewport
      if (!vv) return
      const kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      if (kbHeight > 100) {
        openKeyboard(kbHeight)
      } else {
        openKeyboard(0)
      }
    }

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', onViewportResize)
      vv.addEventListener('scroll', onViewportResize)
    }

    // Method 2: focusin/focusout as fallback
    function onFocusIn(e: FocusEvent) {
      const el = e.target as HTMLElement
      if (!el || !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return

      // Wait for keyboard animation
      setTimeout(() => {
        const el = document.activeElement as HTMLElement
        if (!el) return

        // Check if visualViewport detected keyboard
        if (!keyboardOpen) {
          // Fallback: assume ~40% of screen is keyboard on mobile
          const isMobile = window.innerWidth < 1024
          if (isMobile) {
            openKeyboard(Math.round(window.innerHeight * 0.4))
          }
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 400)

      // Second attempt after animation fully completes
      setTimeout(() => {
        const el = document.activeElement as HTMLElement
        if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 700)
    }

    function onFocusOut() {
      // Small delay to avoid flicker when moving between inputs
      setTimeout(() => {
        if (!document.activeElement || !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          openKeyboard(0)
        }
      }, 100)
    }

    document.addEventListener('focusin', onFocusIn, { passive: true })
    document.addEventListener('focusout', onFocusOut, { passive: true })

    // Method 3: window resize (Capacitor native resize)
    let lastHeight = window.innerHeight
    function onWindowResize() {
      const newHeight = window.innerHeight
      if (newHeight < lastHeight - 100) {
        // Keyboard opened — scroll active element
        setTimeout(() => {
          const el = document.activeElement as HTMLElement
          if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      } else if (newHeight > lastHeight + 100) {
        // Keyboard closed
        openKeyboard(0)
      }
      lastHeight = newHeight
    }
    window.addEventListener('resize', onWindowResize, { passive: true })

    // Method 4: Capacitor Keyboard plugin
    let capCleanup: (() => void) | undefined
    ;(async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard')
        const showH = await Keyboard.addListener('keyboardWillShow', (info) => {
          openKeyboard(info.keyboardHeight)
        })
        const hideH = await Keyboard.addListener('keyboardWillHide', () => {
          openKeyboard(0)
        })
        capCleanup = () => { showH.remove(); hideH.remove() }
      } catch {}
    })()

    return () => {
      if (vv) {
        vv.removeEventListener('resize', onViewportResize)
        vv.removeEventListener('scroll', onViewportResize)
      }
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('resize', onWindowResize)
      capCleanup?.()
      spacerEl?.remove()
    }
  }, [])

  return null
}

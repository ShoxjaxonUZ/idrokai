import { createContext, useContext, useState, useEffect } from 'react'
import { flushSync } from 'react-dom'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Tema almashish — chiroyli "doira bo'lib ochilish" effekti (View Transitions API).
  // Tugma bosilgan nuqtadan yangi tema doira shaklida yoyiladi.
  const toggleTheme = (event) => {
    const next = theme === 'dark' ? 'light' : 'dark'

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Eski brauzerlar yoki "kam harakat" rejimi — oddiy almashish
    if (!document.startViewTransition || reduce) {
      setTheme(next)
      return
    }

    // Bosilgan nuqta (klaviatura bo'lsa — tugma markazi yoki yuqori-o'ng burchak)
    let x = window.innerWidth - 48
    let y = 28
    const t = event?.currentTarget
    if (t && t.getBoundingClientRect) {
      const r = t.getBoundingClientRect()
      x = r.left + r.width / 2
      y = r.top + r.height / 2
    }
    if (event && event.clientX) { x = event.clientX; y = event.clientY }

    // Eng uzoq burchakkacha radius
    const endR = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next))
    })

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endR}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 520,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      )
    }).catch(() => {})
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

'use client'

import { useState, useEffect, useRef } from 'react'

interface Section {
  id: string
  label: string
}

export default function MobileSectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id || '')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // Observe sections to highlight active tab
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    )

    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [sections])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActive(id)
    }
  }

  return (
    <div className="lg:hidden sticky top-[calc(3rem+env(safe-area-inset-top,0px))] z-30 bg-white border-b border-one70-border -mx-3 px-3 overflow-x-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="flex gap-0">
        {sections.map(s => (
          <button key={s.id} onClick={() => scrollTo(s.id)}
            className={`shrink-0 px-3.5 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              active === s.id
                ? 'border-one70-black text-one70-black'
                : 'border-transparent text-one70-mid'
            }`}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

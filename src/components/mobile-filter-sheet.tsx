'use client'

import { useState, ReactNode } from 'react'
import { Filter, X } from 'lucide-react'

interface Props {
  children: ReactNode
  activeCount?: number
  onClear?: () => void
}

export default function MobileFilterSheet({ children, activeCount = 0, onClear }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Trigger button — only on mobile */}
      <div className="lg:hidden flex items-center gap-2 mb-3">
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-one70-border rounded-xl text-sm font-medium text-one70-dark active:bg-gray-50">
          <Filter size={16} />
          Filters
          {activeCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-one70-black text-white text-[10px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && onClear && (
          <button onClick={onClear} className="text-xs text-one70-mid active:text-red-500">Clear all</button>
        )}
      </div>

      {/* Desktop — show inline */}
      <div className="hidden lg:block">
        {children}
      </div>

      {/* Mobile — bottom sheet */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] overflow-y-auto overscroll-contain"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 sticky top-0 bg-white z-10 border-b border-one70-border">
              <h3 className="text-base font-bold text-one70-black">Filters</h3>
              <div className="flex items-center gap-2">
                {activeCount > 0 && onClear && (
                  <button onClick={() => { onClear(); setOpen(false) }} className="text-xs text-red-500 font-medium px-2 py-1">Clear all</button>
                )}
                <button onClick={() => setOpen(false)} className="p-2 -mr-2 rounded-full active:bg-gray-100">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-5">
              {children}
            </div>
            <div className="px-5 pb-2">
              <button onClick={() => setOpen(false)}
                className="w-full py-3 bg-one70-black text-white rounded-xl text-sm font-semibold active:bg-one70-dark">
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

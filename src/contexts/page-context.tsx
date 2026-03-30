'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface PageContext {
  type: 'dashboard' | 'deal' | 'contact' | 'organization' | 'project' | 'task' | 'property' | 'other'
  id?: string
  name?: string
  data?: Record<string, any>
}

interface PageContextValue {
  context: PageContext
  setPageContext: (ctx: PageContext) => void
}

const PageContextCtx = createContext<PageContextValue>({
  context: { type: 'dashboard' },
  setPageContext: () => {},
})

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<PageContext>({ type: 'dashboard' })

  const setPageContext = useCallback((ctx: PageContext) => {
    setContext(ctx)
  }, [])

  return (
    <PageContextCtx.Provider value={{ context, setPageContext }}>
      {children}
    </PageContextCtx.Provider>
  )
}

export function usePageContext() {
  return useContext(PageContextCtx)
}

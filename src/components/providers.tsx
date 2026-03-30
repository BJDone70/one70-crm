'use client'

import { ReactNode } from 'react'
import { PageContextProvider } from '@/contexts/page-context'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PageContextProvider>
      {children}
    </PageContextProvider>
  )
}

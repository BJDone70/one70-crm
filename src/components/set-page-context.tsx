'use client'

import { useEffect } from 'react'
import { usePageContext, PageContext } from '@/contexts/page-context'

export default function SetPageContext({ context }: { context: PageContext }) {
  const { setPageContext } = usePageContext()

  useEffect(() => {
    setPageContext(context)
    return () => setPageContext({ type: 'other' })
  }, [context.type, context.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

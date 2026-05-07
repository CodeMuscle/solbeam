'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Token } from '@/lib/types'

const POLL_INTERVAL_MS = 30_000

export function useRealtimeTokens(initialTokens: Token[]) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setTokens(data as Token[])
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('tokens-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTokens((prev) => {
              const incoming = payload.new as Token
              if (prev.some((t) => t.mint === incoming.mint)) return prev
              return [incoming, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setTokens((prev) =>
              prev.map((t) =>
                t.mint === (payload.new as Token).mint ? (payload.new as Token) : t
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setTokens((prev) =>
              prev.filter((t) => t.mint !== (payload.old as Token).mint)
            )
          }
        }
      )
      .subscribe()

    const pollInterval = setInterval(refetch, POLL_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refetch])

  return tokens
}

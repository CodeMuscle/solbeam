'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Token } from '@/lib/types'

export function useRealtimeTokens(initialTokens: Token[]) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('tokens-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTokens((prev) => [payload.new as Token, ...prev])
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return tokens
}

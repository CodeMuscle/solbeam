'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
} from 'lightweight-charts'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

interface Props {
  candles: Candle[]
  symbol: string
}

export function PriceChart({ candles, symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#555',
      },
      grid: {
        vertLines: { color: '#111' },
        horzLines: { color: '#111' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1a1a1a' },
      timeScale: { borderColor: '#1a1a1a', timeVisible: true },
      width: containerRef.current.clientWidth,
      height: 280,
    })

    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00ff96',
      downColor: '#ff4444',
      borderUpColor: '#00ff96',
      borderDownColor: '#ff4444',
      wickUpColor: '#00ff96',
      wickDownColor: '#ff4444',
    })

    candleSeries.setData(candles as Parameters<typeof candleSeries.setData>[0])
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [candles])

  if (candles.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
        <span className="text-[#333] text-sm">No chart data available</span>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] overflow-hidden">
      <div className="px-4 py-2 border-b border-[#111] text-xs text-[#444] font-mono">
        {symbol} · 1m candles
      </div>
      <div ref={containerRef} />
    </div>
  )
}

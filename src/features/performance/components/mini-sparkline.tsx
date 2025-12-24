// src/features/performance/components/mini-sparkline.tsx
'use client'

interface MiniSparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  fillColor?: string
}

export function MiniSparkline({
  data,
  width = 100,
  height = 30,
  color = '#3b82f6',
  fillColor = 'rgba(59, 130, 246, 0.1)'
}: MiniSparklineProps) {
  if (data.length === 0) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  // Create SVG path for line
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })

  const linePath = `M ${points.join(' L ')}`
  const areaPath = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Fill area */}
      <path
        d={areaPath}
        fill={fillColor}
        className="transition-all duration-300"
      />
      {/* Line */}
      <path
        d={linePath}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
      />
      {/* Dots at each point */}
      {data.map((value, index) => {
        const x = (index / (data.length - 1)) * width
        const y = height - ((value - min) / range) * height
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={2}
            fill={color}
            className="transition-all duration-300"
          />
        )
      })}
    </svg>
  )
}

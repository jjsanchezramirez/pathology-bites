'use client'

import { useRef } from 'react'
import Image from 'next/image'

const logos = [
  { id: 'leeds', src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/university-of-leeds-logo.png', alt: 'University of Leeds' },
  { id: 'pathpresenter', src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/path-presenter-logo.png', alt: 'PathPresenter' },
  { id: 'mgh', src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/mgh-logo.png', alt: 'MGH' },
  { id: 'toronto', src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/university-of-toronto-logo.png', alt: 'University of Toronto' },
  { id: 'rosai', src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/rosai-collection-logo.png', alt: 'Rosai Collection' },
  { id: 'hematopathology', src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/hematopathology-etutorial-logo.png', alt: 'Hematopathology eTutorial' },
  { id: 'recut', src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/recut-club-logo.png', alt: 'Recut Club' }
]

export function MouseAvoidingLogos() {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    const mouseX = e.clientX
    const mouseY = e.clientY

    // Get all logo elements and update them
    const logoElements = container.querySelectorAll('.logo-item')
    logoElements.forEach((logoEl) => {
      const element = logoEl as HTMLElement
      const logoRect = element.getBoundingClientRect()
      const logoCenterX = logoRect.left + logoRect.width / 2
      const logoCenterY = logoRect.top + logoRect.height / 2

      const deltaX = logoCenterX - mouseX
      const deltaY = logoCenterY - mouseY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      const INFLUENCE_DISTANCE = 180
      const MAX_MOVE = 10

      if (distance < INFLUENCE_DISTANCE && distance > 0) {
        const influence = (INFLUENCE_DISTANCE - distance) / INFLUENCE_DISTANCE
        const moveDistance = influence * MAX_MOVE

        const directionX = deltaX / distance
        const directionY = deltaY / distance

        const moveX = directionX * moveDistance
        const moveY = directionY * moveDistance

        element.style.transform = `translate(-50%, -50%) translate(${moveX}px, ${moveY}px)`
        element.style.transition = 'transform 0.1s ease-out'
      } else {
        element.style.transform = 'translate(-50%, -50%)'
        element.style.transition = 'transform 0.3s ease-out'
      }
    })
  }

  const handleMouseLeave = () => {
    const container = containerRef.current
    if (!container) return

    const logoElements = container.querySelectorAll('.logo-item')
    logoElements.forEach((logoEl) => {
      const element = logoEl as HTMLElement
      element.style.transform = 'translate(-50%, -50%)'
      element.style.transition = 'transform 0.3s ease-out'
    })
  }

  const positions = [
    { left: '35%', top: '25%' }, // top-left
    { left: '65%', top: '25%' }, // top-right
    { left: '20%', top: '50%' }, // middle-left
    { left: '50%', top: '50%' }, // middle-center
    { left: '80%', top: '50%' }, // middle-right
    { left: '35%', top: '75%' }, // bottom-left
    { left: '65%', top: '75%' }  // bottom-right
  ]

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[400px] bg-gray-50/30 rounded-lg"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {logos.map((logo, index) => (
        <div
          key={logo.id}
          className="logo-item absolute w-28 h-16 bg-white rounded-lg shadow-sm border flex items-center justify-center p-2 cursor-pointer hover:shadow-md"
          style={{
            left: positions[index].left,
            top: positions[index].top,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <Image
            src={logo.src}
            alt={logo.alt}
            width={100}
            height={50}
            unoptimized
            className="object-contain"
          />
        </div>
      ))}
    </div>
  )
}

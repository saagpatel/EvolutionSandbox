import type { PointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Creature, GenerationSnapshot } from '@/domain/types'

interface PositionedCreature {
  creature: Creature
  x: number
  y: number
  radius: number
}

function hashId(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function layoutCreature(
  creature: Creature,
  width: number,
  height: number,
  phase: number,
): PositionedCreature {
  const hash = hashId(creature.id)
  const jitterX = ((hash & 255) / 255 - 0.5) * 18
  const jitterY = (((hash >> 8) & 255) / 255 - 0.5) * 18
  const pulse = Math.sin(phase * 0.002 + (hash % 360)) * 2 * creature.speed
  const x = 24 + creature.speed * (width - 48) + jitterX + pulse
  const y = 24 + (1 - creature.camouflage) * (height - 48) + jitterY
  const radius = 3 + creature.size * 8

  return {
    creature,
    x,
    y,
    radius,
  }
}

function drawCreature(
  context: CanvasRenderingContext2D,
  positioned: PositionedCreature,
  selected: boolean,
): void {
  const { creature, x, y, radius } = positioned
  const contrast = 0.3 + (1 - creature.camouflage) * 0.65
  const bodyColor = `hsla(${145 - creature.camouflage * 45}, ${55 + creature.camouflage * 20}%, ${42 + creature.camouflage * 16}%, ${contrast})`
  const outlineColor = selected ? '#fff7dd' : 'rgba(7, 16, 20, 0.6)'

  context.save()
  context.translate(x, y)
  context.fillStyle = bodyColor
  context.strokeStyle = outlineColor
  context.lineWidth = selected ? 2.5 : 1.2
  context.beginPath()
  context.ellipse(0, 0, radius * 1.1, radius, 0, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  context.fillStyle = 'rgba(255, 255, 255, 0.85)'
  context.beginPath()
  context.arc(radius * 0.7, -radius * 0.1, Math.max(1.3, radius * 0.16), 0, Math.PI * 2)
  context.fill()

  if (creature.energyEfficiency > 0.62) {
    context.strokeStyle = 'rgba(249, 199, 79, 0.75)'
    context.lineWidth = 1.4
    context.beginPath()
    context.arc(0, 0, radius + 3, 0, Math.PI * 1.6)
    context.stroke()
  }

  context.restore()
}

export function PopulationCanvas({
  snapshot,
  selectedCreatureId,
  onSelectCreature,
}: {
  snapshot: GenerationSnapshot
  selectedCreatureId: string | null
  onSelectCreature: (creatureId: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const positionsRef = useRef<PositionedCreature[]>([])
  const [reducedMotion, setReducedMotion] = useState(false)

  const creatures = useMemo(() => snapshot.creatures, [snapshot.creatures])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setReducedMotion(mediaQuery.matches)
    }

    apply()
    mediaQuery.addEventListener('change', apply)
    return () => {
      mediaQuery.removeEventListener('change', apply)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) {
      return undefined
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return undefined
    }

    let frameId = 0
    let width = 0
    let height = 0

    const resize = () => {
      width = wrapper.clientWidth
      height = wrapper.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrapper)

    const drawFrame = (time: number) => {
      context.clearRect(0, 0, width, height)
      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#16303c')
      gradient.addColorStop(1, '#0b1820')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)

      positionsRef.current = creatures.map((creature) => layoutCreature(creature, width, height, reducedMotion ? 0 : time))

      for (const positioned of positionsRef.current) {
        drawCreature(context, positioned, positioned.creature.id === selectedCreatureId)
      }

      context.fillStyle = 'rgba(225, 243, 248, 0.75)'
      context.font = '12px "Trebuchet MS", "Segoe UI", sans-serif'
      context.fillText('More speed →', width - 92, height - 12)
      context.save()
      context.translate(18, 112)
      context.rotate(-Math.PI / 2)
      context.fillText('More camouflage ↑', 0, 0)
      context.restore()

      if (!reducedMotion) {
        frameId = window.requestAnimationFrame(drawFrame)
      }
    }

    if (reducedMotion) {
      drawFrame(0)
    } else {
      frameId = window.requestAnimationFrame(drawFrame)
    }
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frameId)
    }
  }, [creatures, reducedMotion, selectedCreatureId])

  function findCreatureAtPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) {
      return null
    }

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    return positionsRef.current.find((positioned) => Math.hypot(positioned.x - x, positioned.y - y) <= positioned.radius + 4)
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType !== 'mouse') {
      return
    }

    const match = findCreatureAtPoint(event)

    if (match?.creature.id && match.creature.id !== selectedCreatureId) {
      onSelectCreature(match.creature.id)
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const match = findCreatureAtPoint(event)
    onSelectCreature(match?.creature.id ?? null)
  }

  return (
    <section className="canvas-panel panel">
      <div className="panel__header">
        <p className="eyebrow">Population View</p>
        <h2>Phenotype field</h2>
        <p className="muted">
          X position shows speed, Y position shows camouflage, size controls scale, and a gold ring hints at energy efficiency.
        </p>
      </div>
      <p id="phenotype-field-description" className="sr-only">
        The canvas is a visual phenotype field. Use the creature roster and inspector for the keyboard-accessible reading of
        the same selected creature.
      </p>
      <div className="canvas-wrap" ref={wrapperRef}>
        <canvas
          ref={canvasRef}
          aria-label="Population phenotype field"
          aria-describedby="phenotype-field-description"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />
        <div className="canvas-overlay">
        <div>
          <span>Selected population</span>
          <strong>{snapshot.populationSize}</strong>
        </div>
        <div>
          <span>Survival rate</span>
            <strong>{Math.round(snapshot.survivalRate * 100)}%</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

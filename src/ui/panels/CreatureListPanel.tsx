import { useMemo, useRef, useState } from 'react'

import type { Creature } from '@/domain/types'

function formatCreatureLabel(creature: Creature): string {
  return `${creature.id} · ${Math.round(creature.currentSurvivalProbability * 100)}% survival`
}

export function CreatureListPanel({
  creatures,
  selectedCreatureId,
  onSelectCreature,
}: {
  creatures: Creature[]
  selectedCreatureId: string | null
  onSelectCreature: (creatureId: string | null) => void
}) {
  const rankedCreatures = useMemo(
    () =>
      [...creatures]
        .sort((left, right) => right.currentSurvivalProbability - left.currentSurvivalProbability)
        .slice(0, 10),
    [creatures],
  )
  const optionRefs = useRef<Array<HTMLLIElement | null>>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const selectedIndex = rankedCreatures.findIndex((creature) => creature.id === selectedCreatureId)
  const focusIndexValue = selectedIndex >= 0 ? selectedIndex : activeIndex

  function focusIndex(nextIndex: number) {
    const clampedIndex = Math.max(0, Math.min(nextIndex, rankedCreatures.length - 1))
    const creature = rankedCreatures[clampedIndex]
    if (!creature) {
      return
    }

    setActiveIndex(clampedIndex)
    optionRefs.current[clampedIndex]?.focus()
    onSelectCreature(creature.id)
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <p className="eyebrow">Accessible Selection</p>
        <h2>Creature roster</h2>
        <p className="muted">
          Use this keyboard-first list to inspect creatures without relying on the canvas alone.
        </p>
      </div>

      <div className="stack-actions">
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => onSelectCreature(null)}
        >
          Clear selection
        </button>
      </div>

      <ul className="creature-list" role="listbox" aria-label="Creature roster">
        {rankedCreatures.map((creature, index) => {
          const isSelected = selectedCreatureId === creature.id
          const isActive = focusIndexValue === index

          return (
            <li
              key={creature.id}
              ref={(node) => {
                optionRefs.current[index] = node
              }}
              id={`creature-option-${creature.id}`}
              role="option"
              aria-selected={isSelected}
              className={`creature-pill ${isSelected ? 'creature-pill--active' : ''}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                setActiveIndex(index)
                onSelectCreature(creature.id)
              }}
              onKeyDown={(event) => {
                switch (event.key) {
                  case 'ArrowDown':
                  case 'ArrowRight':
                    event.preventDefault()
                    focusIndex(index + 1)
                    break
                  case 'ArrowUp':
                  case 'ArrowLeft':
                    event.preventDefault()
                    focusIndex(index - 1)
                    break
                  case 'Home':
                    event.preventDefault()
                    focusIndex(0)
                    break
                  case 'End':
                    event.preventDefault()
                    focusIndex(rankedCreatures.length - 1)
                    break
                  case 'Enter':
                  case ' ':
                    event.preventDefault()
                    onSelectCreature(creature.id)
                    break
                  default:
                    break
                }
              }}
            >
              <span>{formatCreatureLabel(creature)}</span>
              <strong>born g{creature.generationBorn}</strong>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

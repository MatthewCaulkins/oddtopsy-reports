'use client'

import { useState } from 'react'
import type { Submission } from '@/payload-types'
import { PaperCard } from './PaperCard'

type PaperCarouselProps = {
  papers: Submission[]
}

export function PaperCarousel({ papers }: PaperCarouselProps) {
  const [index, setIndex] = useState(0)

  if (papers.length === 0) return null

  const visible = [
    papers[(index - 1 + papers.length) % papers.length],
    papers[index],
    papers[(index + 1) % papers.length],
  ]

  // if (visible.length < 2 && papers.length > 1) {
  //   visible.push(...papers.slice(0, 2 - visible.length))
  // }

  function previous() {
    setIndex((current) => (current === 0 ? Math.max(papers.length - 1, 0) : current - 1))
  }

  function next() {
    setIndex((current) => (current + 1) % papers.length)
  }

  return (
    <div className="paper-carousel">
      <button
        className="paper-carousel-arrow prev"
        type="button"
        onClick={previous}
        aria-label="Previous paper"
      />

      <div className="paper-carousel-viewport">
        <div className="paper-carousel-track">
          {visible.map((paper, visibleIndex) => (
            <div
              className={['paper-carousel-slide', visibleIndex === 1 && 'is-active']
                .filter(Boolean)
                .join(' ')}
              key={`${paper.id}-${index}-${visibleIndex}`}
            >
              <PaperCard paper={paper} compact />
            </div>
          ))}
        </div>
      </div>

      <button
        className="paper-carousel-arrow next"
        type="button"
        onClick={next}
        aria-label="Next paper"
      />
    </div>
  )
}

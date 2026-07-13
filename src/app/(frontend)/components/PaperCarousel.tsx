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

  const visible = papers.slice(index, index + 2)

  if (visible.length < 2 && papers.length > 1) {
    visible.push(...papers.slice(0, 2 - visible.length))
  }

  function previous() {
    setIndex((current) => (current === 0 ? Math.max(papers.length - 1, 0) : current - 1))
  }

  function next() {
    setIndex((current) => (current + 1) % papers.length)
  }

  return (
    <div className="paper-carousel">
      <div className="paper-carousel-controls">
        <button className="prev" type="button" onClick={previous} aria-label="Previous papers" />
        <button className="next" type="button" onClick={next} aria-label="Next papers" />
      </div>

      <div className="paper-carousel-track">
        {visible.map((paper) => (
          <PaperCard paper={paper} compact key={`${paper.id}-${index}`} />
        ))}
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

interface DemoCardProps {
  children: ReactNode
  description: ReactNode
  eyebrow: string
  title: string
  titleId: string
}

export function DemoCard({
  children,
  description,
  eyebrow,
  title,
  titleId,
}: DemoCardProps) {
  return (
    <section className="counter-card" aria-labelledby={titleId}>
      <div className="card-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </div>

      {children}
    </section>
  )
}

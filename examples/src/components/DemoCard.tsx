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
    <section
      className="grid gap-7 rounded-[2rem] border border-stone-200/80 bg-white/82 p-6 shadow-[0_24px_80px_rgba(46,38,24,0.08)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/72 sm:p-8"
      aria-labelledby={titleId}
    >
      <div className="grid gap-2 text-left">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
          {eyebrow}
        </p>
        <h2
          id={titleId}
          className="text-2xl font-semibold tracking-[-0.03em] text-zinc-950 dark:text-stone-50 sm:text-4xl"
        >
          {title}
        </h2>
        <p className="max-w-3xl text-stone-600 dark:text-stone-300">{description}</p>
      </div>

      {children}
    </section>
  )
}

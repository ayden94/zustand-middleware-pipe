interface CountPanelProps {
  compact?: boolean
  label: string
  value: number
}

export function CountPanel({ compact = false, label, value }: CountPanelProps) {
  return (
    <div
      className={`grid place-items-center gap-1 rounded-[1.75rem] bg-gradient-to-br from-violet-100 to-transparent dark:from-violet-500/20 ${
        compact ? 'min-h-32' : 'min-h-44'
      }`}
    >
      <span className="text-xs font-black uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
        {label}
      </span>
      <strong
        className={`font-semibold leading-none tracking-[-0.08em] text-zinc-950 dark:text-stone-50 ${
          compact ? 'text-6xl sm:text-7xl' : 'text-7xl sm:text-9xl'
        }`}
      >
        {value}
      </strong>
    </div>
  )
}

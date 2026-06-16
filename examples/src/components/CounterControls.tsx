interface CounterControlsProps {
  onDecrement: () => void
  onIncrement: () => void
  onReset: () => void
}

export function CounterControls({
  onDecrement,
  onIncrement,
  onReset,
}: CounterControlsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className="min-w-28 rounded-full bg-zinc-950 px-5 py-3 font-black text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-violet-300 dark:bg-stone-50 dark:text-zinc-950"
        onClick={onDecrement}
      >
        -1
      </button>
      <button
        type="button"
        className="min-w-28 rounded-full bg-violet-600 px-5 py-3 font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-500 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
        onClick={onIncrement}
      >
        +1
      </button>
      <button
        type="button"
        className="min-w-28 rounded-full bg-stone-200 px-5 py-3 font-black text-zinc-950 transition hover:-translate-y-0.5 hover:bg-stone-300 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-violet-300 dark:bg-white/10 dark:text-stone-50 dark:hover:bg-white/15"
        onClick={onReset}
      >
        reset
      </button>
    </div>
  )
}

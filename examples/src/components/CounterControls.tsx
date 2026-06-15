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
    <div className="button-row">
      <button type="button" onClick={onDecrement}>
        -1
      </button>
      <button type="button" onClick={onIncrement}>
        +1
      </button>
      <button type="button" className="secondary" onClick={onReset}>
        reset
      </button>
    </div>
  )
}

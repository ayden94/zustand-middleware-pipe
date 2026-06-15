import { CounterControls } from '../../components/CounterControls'
import { CountPanel } from '../../components/CountPanel'
import { DemoCard } from '../../components/DemoCard'
import { useCombinedCounterStore } from '../../store/combined-counter'

export function CombineDemo() {
  const count = useCombinedCounterStore((state) => state.count)
  const decrement = useCombinedCounterStore((state) => state.decrement)
  const increment = useCombinedCounterStore((state) => state.increment)
  const reset = useCombinedCounterStore((state) => state.reset)

  return (
    <DemoCard
      eyebrow="Example 02"
      title="combine inside .create()"
      titleId="combine-title"
      description={
        <>
          <code>combine(...)</code>은 middleware wrapper가 아니라 state creator
          helper라서 <code>.create(combine(...))</code> 형태로 끝에 둡니다.
        </>
      }
    >
      <CountPanel compact label="combined count" value={count} />
      <CounterControls
        onDecrement={decrement}
        onIncrement={increment}
        onReset={reset}
      />
    </DemoCard>
  )
}

import { CounterControls } from '../../components/CounterControls'
import { CountPanel } from '../../components/CountPanel'
import { DemoCard } from '../../components/DemoCard'
import { useReduxCounterStore } from '../../store/redux-counter'

export function ReduxDemo() {
  const count = useReduxCounterStore((state) => state.count)
  const dispatch = useReduxCounterStore((state) => state.dispatch)

  return (
    <DemoCard
      eyebrow="Example 03"
      title="redux inside .create()"
      titleId="redux-title"
      description={
        <>
          <code>redux(reducer, initialState)</code>도 terminal helper로 사용하고,
          store state에 추가된 <code>dispatch</code>를 그대로 호출합니다.
        </>
      }
    >
      <CountPanel compact label="redux count" value={count} />
      <CounterControls
        onDecrement={() => dispatch({ type: 'decrement' })}
        onIncrement={() => dispatch({ type: 'increment' })}
        onReset={() => dispatch({ type: 'reset' })}
      />
    </DemoCard>
  )
}

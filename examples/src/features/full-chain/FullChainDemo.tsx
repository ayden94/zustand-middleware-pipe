import { useEffect, useState } from 'react'
import { CounterControls } from '../../components/CounterControls'
import { CountPanel } from '../../components/CountPanel'
import { DemoCard } from '../../components/DemoCard'
import { useFullChainCounterStore } from '../../store/full-chain-counter'

export function FullChainDemo() {
  const count = useFullChainCounterStore((state) => state.count)
  const label = useFullChainCounterStore((state) => state.label)
  const decrement = useFullChainCounterStore((state) => state.decrement)
  const increment = useFullChainCounterStore((state) => state.increment)
  const reset = useFullChainCounterStore((state) => state.reset)
  const setLabel = useFullChainCounterStore((state) => state.setLabel)
  const [lastChange, setLastChange] = useState('아직 변경 없음')

  useEffect(() => {
    return useFullChainCounterStore.subscribe(
      (state) => state.count,
      (currentCount, previousCount) => {
        setLastChange(`${previousCount} → ${currentCount}`)
      },
    )
  }, [])

  return (
    <DemoCard
      eyebrow="Example 01"
      title="Full middleware chain"
      titleId="full-stack-title"
      description={
        <>
          <code>immer</code>, <code>persist</code>,{' '}
          <code>subscribeWithSelector</code>, <code>devtools</code>를 모두
          <code>.use(...)</code>로 조합합니다.
        </>
      }
    >
      <label className="field">
        <span>Persisted label</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="라벨을 입력하세요"
        />
      </label>

      <CountPanel label="현재 count" value={count} />
      <CounterControls
        onDecrement={decrement}
        onIncrement={increment}
        onReset={reset}
      />

      <dl className="checks">
        <div>
          <dt>.use(immer())</dt>
          <dd>action 내부에서 draft mutation으로 count를 변경합니다.</dd>
        </div>
        <div>
          <dt>.use(persist())</dt>
          <dd>새로고침 후에도 count와 label이 유지됩니다.</dd>
        </div>
        <div>
          <dt>.use(subscribeWithSelector())</dt>
          <dd>selector subscribe 결과: {lastChange}</dd>
        </div>
        <div>
          <dt>.use(devtools())</dt>
          <dd>Redux DevTools가 있으면 action 이름이 표시됩니다.</dd>
        </div>
      </dl>
    </DemoCard>
  )
}

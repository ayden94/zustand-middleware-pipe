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
    let previousCount = useFullChainCounterStore.getState().count

    return useFullChainCounterStore.subscribe((state) => {
      const currentCount = state.count

      if (currentCount !== previousCount) {
        setLastChange(`${previousCount} → ${currentCount}`)
        previousCount = currentCount
      }
    })
  }, [])

  return (
    <DemoCard
      eyebrow="Example 01"
      title="Full middleware chain"
      titleId="full-stack-title"
      description={
        <>
          <code>devtools</code>, <code>subscribeWithSelector</code>,{' '}
          <code>persist</code>, <code>immer</code>를 모두 <code>.use(...)</code>로
          조합합니다.
        </>
      }
    >
      <label className="grid gap-2 text-left font-bold text-zinc-950 dark:text-stone-50">
        <span>Persisted label</span>
        <input
          className="w-full rounded-2xl border border-stone-200 bg-white/70 px-4 py-3 text-zinc-950 outline-none transition focus-visible:border-violet-400 focus-visible:ring-4 focus-visible:ring-violet-200 dark:border-white/10 dark:bg-white/5 dark:text-stone-50 dark:focus-visible:ring-violet-500/20"
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

      <dl className="grid gap-3 text-left sm:grid-cols-2">
        <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 dark:border-white/10 dark:bg-white/5">
          <dt>.use(devtools())</dt>
          <dd>Redux DevTools가 있으면 action 이름이 표시됩니다.</dd>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 dark:border-white/10 dark:bg-white/5">
          <dt>.use(subscribeWithSelector())</dt>
          <dd>selector subscribe 결과: {lastChange}</dd>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 dark:border-white/10 dark:bg-white/5">
          <dt>.use(persist())</dt>
          <dd>새로고침 후에도 count와 label이 유지됩니다.</dd>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 dark:border-white/10 dark:bg-white/5">
          <dt>.use(immer())</dt>
          <dd>action 내부에서 draft mutation으로 count를 변경합니다.</dd>
        </div>
      </dl>
    </DemoCard>
  )
}

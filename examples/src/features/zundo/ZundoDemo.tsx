import { CounterControls } from '../../components/CounterControls'
import { CountPanel } from '../../components/CountPanel'
import { DemoCard } from '../../components/DemoCard'
import {
  useTemporalCounterStore,
  useTemporalHistoryDepth,
} from '../../store/temporal-counter'

export function ZundoDemo() {
  const count = useTemporalCounterStore((state) => state.count)
  const decrement = useTemporalCounterStore((state) => state.decrement)
  const increment = useTemporalCounterStore((state) => state.increment)
  const reset = useTemporalCounterStore((state) => state.reset)
  const { futureDepth, pastDepth } = useTemporalHistoryDepth()
  const temporalStore = useTemporalCounterStore.temporal.getState()

  return (
    <DemoCard
      eyebrow="Example 04"
      title="zundo temporal history"
      titleId="zundo-title"
      description={
        <>
          <code>temporal()</code>은 optional zundo subpath에서 import하고, pipe는
          zundo의 <code>store.temporal</code> 타입을 그대로 보존합니다. 이 예제는
          <code>wrapTemporal</code> 안에서도 다시 <code>pipe.use(persist())</code>를
          사용해 history store를 저장합니다.
        </>
      }
    >
      <CountPanel label="time-travel count" value={count} />
      <CounterControls
        onDecrement={decrement}
        onIncrement={increment}
        onReset={reset}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full bg-zinc-950 px-5 py-3 font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-stone-50 dark:text-zinc-950"
          disabled={pastDepth === 0}
          onClick={() => temporalStore.undo()}
        >
          undo
        </button>
        <button
          type="button"
          className="rounded-full bg-violet-600 px-5 py-3 font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={futureDepth === 0}
          onClick={() => temporalStore.redo()}
        >
          redo
        </button>
        <button
          type="button"
          className="rounded-full bg-stone-200 px-5 py-3 font-black text-zinc-950 transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-stone-50"
          onClick={() => temporalStore.clear()}
        >
          clear history
        </button>
      </div>

      <dl className="grid gap-3 text-left sm:grid-cols-2">
        <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 dark:border-white/10 dark:bg-white/5">
          <dt className="font-black text-zinc-950 dark:text-stone-50">past states</dt>
          <dd className="mt-2 text-stone-600 dark:text-stone-300">
            {pastDepth} snapshots can be undone.
          </dd>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 dark:border-white/10 dark:bg-white/5">
          <dt className="font-black text-zinc-950 dark:text-stone-50">future states</dt>
          <dd className="mt-2 text-stone-600 dark:text-stone-300">
            {futureDepth} snapshots can be redone.
          </dd>
        </div>
      </dl>

      <div className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5 text-left dark:border-violet-400/20 dark:bg-violet-500/10">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
          wrapTemporal
        </p>
        <p className="mt-2 text-stone-700 dark:text-stone-200">
          Main store state and undo/redo history are separate stores. This demo
          persists <code>pastStates</code> and <code>futureStates</code> by piping the
          temporal history creator through <code>persist()</code> inside{' '}
          <code>wrapTemporal</code>.
        </p>
      </div>
    </DemoCard>
  )
}

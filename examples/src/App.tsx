import { useEffect, useState } from 'react'
import './App.css'
import {
  useCombinedCounterStore,
  useCounterStore,
  useReduxCounterStore,
} from './store/counter'

function App() {
  const count = useCounterStore((state) => state.count)
  const label = useCounterStore((state) => state.label)
  const decrement = useCounterStore((state) => state.decrement)
  const increment = useCounterStore((state) => state.increment)
  const reset = useCounterStore((state) => state.reset)
  const setLabel = useCounterStore((state) => state.setLabel)
  const combinedCount = useCombinedCounterStore((state) => state.count)
  const decrementCombined = useCombinedCounterStore((state) => state.decrement)
  const incrementCombined = useCombinedCounterStore((state) => state.increment)
  const resetCombined = useCombinedCounterStore((state) => state.reset)
  const reduxCount = useReduxCounterStore((state) => state.count)
  const dispatchRedux = useReduxCounterStore((state) => state.dispatch)
  const [lastChange, setLastChange] = useState('아직 변경 없음')

  useEffect(() => {
    return useCounterStore.subscribe(
      (state) => state.count,
      (currentCount, previousCount) => {
        setLastChange(`${previousCount} → ${currentCount}`)
      },
    )
  }, [])

  return (
    <main className="app-shell">
      <section className="hero-card" aria-labelledby="demo-title">
        <p className="eyebrow">zustand-middleware-pipe</p>
        <h1 id="demo-title">pipe.use()와 terminal helper 예시</h1>
        <p className="description">
          <code>pipe.use()</code>로 middleware를 왼쪽에서 오른쪽 순서로 조합하고,
          <code>combine</code>과 <code>redux</code>는 <code>.create(...)</code> 안에
          terminal state creator helper로 넣는 패턴을 함께 보여줍니다.
        </p>
      </section>

      <div className="example-grid">
        <section className="counter-card" aria-labelledby="full-stack-title">
          <div className="card-heading">
            <p className="eyebrow">Example 01</p>
            <h2 id="full-stack-title">Full middleware chain</h2>
            <p>
              <code>immer</code>, <code>persist</code>,{' '}
              <code>subscribeWithSelector</code>, <code>devtools</code>를 모두
              <code>.use(...)</code>로 조합합니다.
            </p>
          </div>

          <label className="field">
            <span>Persisted label</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="라벨을 입력하세요"
            />
          </label>

          <div className="count-panel">
            <span className="count-label">현재 count</span>
            <strong>{count}</strong>
          </div>

          <div className="button-row">
            <button type="button" onClick={decrement}>
              -1
            </button>
            <button type="button" onClick={increment}>
              +1
            </button>
            <button type="button" className="secondary" onClick={reset}>
              reset
            </button>
          </div>

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
        </section>

        <section className="counter-card" aria-labelledby="combine-title">
          <div className="card-heading">
            <p className="eyebrow">Example 02</p>
            <h2 id="combine-title">combine inside .create()</h2>
            <p>
              <code>combine(...)</code>은 middleware wrapper가 아니라 state creator
              helper라서 <code>.create(combine(...))</code> 형태로 끝에 둡니다.
            </p>
          </div>

          <div className="count-panel compact">
            <span className="count-label">combined count</span>
            <strong>{combinedCount}</strong>
          </div>

          <div className="button-row">
            <button type="button" onClick={decrementCombined}>
              -1
            </button>
            <button type="button" onClick={incrementCombined}>
              +1
            </button>
            <button type="button" className="secondary" onClick={resetCombined}>
              reset
            </button>
          </div>
        </section>

        <section className="counter-card" aria-labelledby="redux-title">
          <div className="card-heading">
            <p className="eyebrow">Example 03</p>
            <h2 id="redux-title">redux inside .create()</h2>
            <p>
              <code>redux(reducer, initialState)</code>도 terminal helper로 사용하고,
              store state에 추가된 <code>dispatch</code>를 그대로 호출합니다.
            </p>
          </div>

          <div className="count-panel compact">
            <span className="count-label">redux count</span>
            <strong>{reduxCount}</strong>
          </div>

          <div className="button-row">
            <button
              type="button"
              onClick={() => dispatchRedux({ type: 'decrement' })}
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => dispatchRedux({ type: 'increment' })}
            >
              +1
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => dispatchRedux({ type: 'reset' })}
            >
              reset
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App

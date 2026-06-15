import { useEffect, useState } from 'react'
import './App.css'
import { useCounterStore } from './store/counter'

function App() {
  const count = useCounterStore((state) => state.count)
  const label = useCounterStore((state) => state.label)
  const decrement = useCounterStore((state) => state.decrement)
  const increment = useCounterStore((state) => state.increment)
  const reset = useCounterStore((state) => state.reset)
  const setLabel = useCounterStore((state) => state.setLabel)
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
        <h1 id="demo-title">pipe() 미들웨어 테스트</h1>
        <p className="description">
          <code>pipe()</code>로 Zustand middleware를 왼쪽에서 오른쪽 순서로
          조합했습니다. 카운터 값과 라벨은 <code>persist</code>로 localStorage에
          저장됩니다.
        </p>
      </section>

      <section className="counter-card" aria-label="Counter demo">
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

        <div className="button-row" aria-label="Counter actions">
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
    </main>
  )
}

export default App

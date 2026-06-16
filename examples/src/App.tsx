import './App.css'
import { CombineDemo } from './features/combine/CombineDemo'
import { FullChainDemo } from './features/full-chain/FullChainDemo'
import { ReduxDemo } from './features/redux/ReduxDemo'

function App() {
  return (
    <main className="app-shell">
      <section className="hero-card" aria-labelledby="demo-title">
        <p className="eyebrow">zustand-middleware-pipe</p>
        <h1 id="demo-title">pipe.use()와 terminal helper 예시</h1>
        <p className="description">
          <code>pipe.use()</code>로 middleware wrapper를 위에서 아래 순서로 조합하고,
          <code>combine</code>과 <code>redux</code>는 <code>.create(...)</code> 안에
          terminal state creator helper로 넣는 패턴을 함께 보여줍니다.
        </p>
      </section>

      <div className="example-grid">
        <FullChainDemo />
        <CombineDemo />
        <ReduxDemo />
      </div>
    </main>
  )
}

export default App

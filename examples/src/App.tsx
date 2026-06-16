import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { CombineDemo } from './features/combine/CombineDemo'
import { FullChainDemo } from './features/full-chain/FullChainDemo'
import { ReduxDemo } from './features/redux/ReduxDemo'
import { ZundoDemo } from './features/zundo/ZundoDemo'

const routes = [
  { path: '/full-chain', label: 'Full chain', element: <FullChainDemo /> },
  { path: '/zundo', label: 'Zundo', element: <ZundoDemo /> },
  { path: '/combine', label: 'Combine', element: <CombineDemo /> },
  { path: '/redux', label: 'Redux', element: <ReduxDemo /> },
]

function App() {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_28rem),linear-gradient(135deg,#fbf7ef,#f6f1ff_48%,#eef7ff)] px-4 py-6 text-stone-700 dark:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.2),transparent_28rem),linear-gradient(135deg,#101012,#15121d_48%,#111827)] dark:text-stone-300 sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <header className="grid gap-8 rounded-[2.5rem] border border-white/70 bg-white/70 p-6 shadow-[0_32px_120px_rgba(53,38,20,0.12)] backdrop-blur dark:border-white/10 dark:bg-zinc-950/50 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <section aria-labelledby="demo-title" className="max-w-3xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.26em] text-violet-600 dark:text-violet-300">
              zustand-middleware-pipe
            </p>
            <h1
              id="demo-title"
              className="text-4xl font-semibold leading-[0.95] tracking-[-0.06em] text-zinc-950 dark:text-stone-50 sm:text-6xl"
            >
              readable middleware stacks, now with routed examples.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-stone-600 dark:text-stone-300">
              Compare built-in chains, terminal helpers, and the optional zundo
              adapter without leaving the Vite example app.
            </p>
          </section>

          <nav className="flex flex-wrap gap-2" aria-label="Example routes">
            {routes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-black transition ${
                    isActive
                      ? 'bg-zinc-950 text-white dark:bg-stone-50 dark:text-zinc-950'
                      : 'bg-white/70 text-zinc-800 hover:bg-white dark:bg-white/10 dark:text-stone-200 dark:hover:bg-white/15'
                  }`
                }
              >
                {route.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/full-chain" replace />} />
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </div>
    </main>
  )
}

export default App

# zustand-middleware-pipe React example

This Vite app exercises the local `zustand-middleware-pipe` package with routed React examples through a `file:..` dependency. The UI uses Tailwind CSS so each middleware composition has its own focused page.

It demonstrates the recommended middleware imports:

```ts
import { pipe } from 'zustand-middleware-pipe'
import {
  combine,
  createJSONStorage,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import { temporal } from 'zustand-middleware-pipe/middleware/zundo'
```

The app includes:

- a full `.use(devtools()).use(subscribeWithSelector()).use(persist()).use(immer())` chain
- a `pipe.use(temporal<TemporalCounterState>()).create(...)` zundo undo/redo history example
- a `pipe.use(devtools()).create(combine(...))` terminal helper example
- a `pipe.use(devtools()).create(redux(...))` terminal helper example
- route-level navigation between examples with `react-router-dom`
- Tailwind-powered layout and component styling

Run it from the repository root:

```sh
npm run example:dev
```

`npm run example:dev` prepares the local package before starting Vite; it does not watch the library's `src/` directory. Use `npm run example:verify` to rebuild the local package, install it into this example, build the Vite app, and run ESLint.

After changing library sources, stop Vite and refresh the installed package and dependency cache from the repository root:

```sh
npm run example:install
npm run dev --prefix examples -- --force
```

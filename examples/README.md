# zustand-middleware-pipe React example

This Vite app exercises the local `zustand-middleware-pipe` package with multiple store examples through a `file:..` dependency.

It demonstrates the recommended middleware imports:

```ts
import { definePipeableMiddleware, pipe } from 'zustand-middleware-pipe'
import {
  combine,
  createJSONStorage,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
```

The page includes:

- a full `.use(devtools()).use(subscribeWithSelector()).use(persist()).use(immer())` chain
- a `pipe.use(devtools()).create(combine(...))` terminal helper example
- a `pipe.use(devtools()).create(redux(...))` terminal helper example

Run it from the repository root:

```sh
npm run example:install
npm run example:dev
```

Use `npm run example:verify` to rebuild the local package, install it into this example, build the Vite app, and run ESLint.

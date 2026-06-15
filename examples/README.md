# zustand-middleware-pipe React example

This Vite app exercises the local `zustand-middleware-pipe@0.1.0` package through a `file:..` dependency.

It demonstrates the recommended middleware imports:

```ts
import { pipe } from 'zustand-middleware-pipe'
import { devtools, persist, subscribeWithSelector } from 'zustand-middleware-pipe/middleware'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
```

Run it from the repository root:

```sh
npm run example:install
npm run example:dev
```

Use `npm run example:verify` to rebuild the package, install it into this example, build the Vite app, and run ESLint.

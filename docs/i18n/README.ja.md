# zustand-middleware-pipe

[English](../../README.md) · [한국어](README.ko.md) · 日本語

[![npm version](https://img.shields.io/npm/v/zustand-middleware-pipe)](https://www.npmjs.com/package/zustand-middleware-pipe)
[![license](https://img.shields.io/npm/l/zustand-middleware-pipe)](../../LICENSE)
[![ESM only](https://img.shields.io/badge/ESM-only-blue)](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

Zustand のミドルウェアスタックを、実際に考える順番で書けるようにします。

## クイックスタート

```sh
npm install zustand-middleware-pipe zustand
```

```ts
import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import { devtools, persist, subscribeWithSelector } from 'zustand-middleware-pipe/middleware'

const useCounterStore = create<CounterState>()(
  pipe
    .use(devtools({ name: 'CounterStore' }))
    .use(subscribeWithSelector())
    .use(persist<CounterState>({ name: 'counter' }))
    .use(immer())
    .create((set) => ({
      count: 0,
      inc: () => set((state) => { state.count += 1 }, false, 'counter/inc'),
    })),
)
```

それだけです。魔法の store replacement でも、新しい state model でもありません。密度の高い middleware stack をもう一度読みやすくする、小さな userland helper です。

この package は [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449) で議論されたアイデアをもとにしています。

---

## 問題: middleware stack は逆向きに読まされる

Zustand の middleware は base creator を包むネストした wrapper として書きます。最も外側の wrapper は見えやすい一方、base creator は最も深い場所に埋まります。4 つの middleware が積まれると、options と state logic が複数のインデント階層に散らばります:

```ts
// wrapper 順序: devtools → subscribeWithSelector → persist → immer → base creator
const useCounterStore = create<CounterState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set) => ({
          count: 0,
          inc: () => set((state) => { state.count += 1 }),
        })),
        { name: 'counter' },
      ),
    ),
    { name: 'CounterStore' },
  ),
)
```

options は散らばります。`persist` の options は中間に埋まり、`devtools` の options はファイルの下に離れ、次の読み手は store の形を理解するためにすべての層を頭の中で剥がさなければなりません。

## 解決: スタックを pipeline として書く

`pipe` を使うと、同じ wrapper stack を上から下へ、base creator を最後に置いて書けます:

```ts
// 記述順序 = ネストした wrapper 表現の順序 ↓
pipe
  .use(devtools({ name: 'CounterStore' }))
  .use(subscribeWithSelector())
  .use(persist<CounterState>({ name: 'counter' }))
  .use(immer())
  .create((set) => ({ ... }))
```

### Before / After 比較

| | Before (inside-out) | After (pipe) |
|---|---|---|
| **読む順序** | 外側の wrapper から、base creator は最深部に埋まる | 上から下へ読み、`.create(...)` で終わる |
| **options の位置** | ネストの各レベルに散在 | 各 `.use(...)` 呼び出しにインライン |
| **`set` 型** | ネスト構造から推論 | builder chain が積み上げて計算 |
| **middleware 追加** | 式全体を再度ラップ | 対応する wrapper 位置に `.use(...)` を挿入 |

評価結果は同一です:

```ts
// pipe は runtime でこれとまったく同じになります
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

---

## インストール

```sh
npm install zustand-middleware-pipe zustand
```

`immer()` を使う場合だけ、追加で `immer` をインストールしてください:

```sh
npm install immer
```

この package は **ESM-only** で、内部の相対 import には bundler-style module resolution を前提とします。

---

## API

```ts
pipe.use(devtools(options?))
  .use(subscribeWithSelector())
  .use(persist<T, PersistedState>(options))
  .use(immer())
  .create(baseCreator)
```

### Middleware wrapper

```ts
immer()
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
combine(initialState, creator)   // .create() の中で使用
redux(reducer, initialState)     // .create() の中で使用
```

### import パス

Immer 以外の wrapper と storage helper は middleware barrel から import します。Immer は optional peer として保持するため専用 subpath を使います:

```ts
import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'

import { immer } from 'zustand-middleware-pipe/middleware/immer'

import {
  combine,
  createJSONStorage,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
```

### builder chain の型安全性

`pipe.use(...)` は middleware を追加するたびに mutator 型を積み上げます。最終的な `.create(baseCreator)` は完全に合成された `set` 型を受け取るため、TypeScript が各 middleware の貢献を検査します:

- `.use(immer())` → `.create(...)` の中で draft mutation が有効になる
- `.use(devtools(...))` → `set` の第三引数に action name を渡せるようになる
- `.use(subscribeWithSelector())` → store に selector subscribe overload が反映される

`.use(...)` 呼び出しを削除すると、対応する機能が型から即座に消えます:

```ts
create<CounterState>()(
  pipe
    .use(persist<CounterState>({ name: 'counter' }))
    // .use(immer()) ← この行を削除すると下の draft mutation が TypeScript エラーになります
    .create((set) => ({
      count: 0,
      inc: () =>
        set((state) => {
          state.count += 1 // ← エラー: set はここで関数を受け取りません
        }),
    })),
)
```

### `persist` と部分的な state

`partialize` を使う場合は、第二 generic に persisted-state 型を渡してください:

```ts
pipe
  .use(devtools({ name: 'CounterStore' }))
  .use(subscribeWithSelector())
  .use(persist<CounterState, Pick<CounterState, 'count'>>({
    name: 'counter',
    partialize: (state) => ({ count: state.count }),
  }))
  .create((set) => ({
    count: 0,
    inc: () => set((state) => ({ count: state.count + 1 }), false, 'counter/inc'),
  }))
```

### `combine` と `redux`

`combine` と `redux` は middleware ではなく Zustand の state-creator helper なので、`.create(...)` の中に置きます:

```ts
const useCombinedCounterStore = create<CounterState>()(
  pipe
    .use(devtools({ name: 'CombinedCounterStore' }))
    .create(
      combine({ count: 0 }, (set) => ({
        inc: () => set((state) => ({ count: state.count + 1 })),
      })),
    ),
)

type CounterAction = { type: 'inc' }
type Dispatch = (action: CounterAction) => CounterAction

const useReduxCounterStore = create<CounterState & { dispatch: Dispatch }>()(
  pipe
    .use(devtools({ name: 'ReduxCounterStore' }))
    .create(redux(reducer, { count: 0 })),
)
```

---

## 重要な caveat

- **公式 Zustand guidance ではありません。** これは userland の実験です。
- **すでに動いている store を書き直さないでください。**
- **Bundler resolution を前提とします。** この package は extensionless な内部相対 import を持つ ESM として emit されるため、bundler-compatible toolchain 経由で使用してください。
- **built-in wrapper の順序は強制されます。** outer-to-inner の順で追加してください: `.use(devtools(...))` → `.use(subscribeWithSelector())` → `.use(persist(...))` → `.use(immer())`. 逆順の built-in wrapper は `.use(...)` で拒否されます。
- **`store.devtools` の可用性**は通常の Zustand devtools の動作に依存します。devtools が無効化されているか Redux DevTools extension がない場合は、利用できないことがあります。
- **サードパーティ middleware** は自動的には合成できません。builder と連携するには、wrapper に正しい mutator tuple 型が必要です。

---

## 開発

```sh
npm install
npm run verify
```

`npm run verify` は typecheck、Vitest、declaration build を実行します。

## サンプル

Vite React のサンプルは `examples/` にあり、local `file:..` dependency でこの package を使っています。

```sh
npm run example:install
npm run example:dev
```

package root から `npm run example:verify` を実行すると、サンプルを build して lint します。

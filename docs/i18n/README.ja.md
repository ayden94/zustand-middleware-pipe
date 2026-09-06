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

`pipe` は middleware pipeline builder です。同じ wrapper stack を上から下へ、base creator を最後に置いて書けます:

```ts
// 記述順序 = ネストした wrapper 表現の順序 ↓
pipe
  .use(devtools({ name: 'CounterStore' }))
  .use(subscribeWithSelector())
  .use(persist<CounterState>({ name: 'counter' }))
  .use(immer())
  .create((set) => ({ ... }))
```

評価結果は同一です:

```ts
// pipe は runtime でこれとまったく同じになります
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

### Before / After 比較

| | Before (inside-out) | After (pipe) |
|---|---|---|
| **読む順序** | 外側の wrapper から、base creator は最深部に埋まる | 上から下へ読み、`.create(...)` で終わる |
| **options の位置** | ネストの各レベルに散在 | 各 `.use(...)` 呼び出しにインライン |
| **`set` 型** | ネスト構造から推論 | builder chain が積み上げて計算 |
| **middleware 追加** | 式全体を再度ラップ | 対応する wrapper 位置に `.use(...)` を挿入 |

---

## LLM で既存 store をリファクタリングする

大きな store をリファクタリングするときは、[`docs/llm-context.md`](../llm-context.md) を canonical LLM input として使ってください。この repository の外で copy/paste prompt として使う場合は、raw GitHub URL の `https://raw.githubusercontent.com/zustandjs/zustand-middleware-pipe/refs/heads/main/docs/llm-context.md` を使ってください。この document は package import rules、middleware order rules、type caveats、before/after examples、safety checklist を一か所にまとめています。

使っている tool が file references をサポートしているなら `@docs/llm-context.md` を添付または mention し、サポートしていない場合は raw URL を渡すか、その document contents を store code より先に貼り付けます。これは `devtools(subscribeWithSelector(persist(immer(...))))` のように options が複数の indentation levels に散らばっている dense stack で特に有効です。

モデルには runtime behavior の preservation を最優先に依頼してください:

- 既存の middleware wrapper order を変えないでください。
- state shape、action names、persistence keys、storage、migrations、devtools options を保持してください。
- `combine(...)` と `redux(...)` が innermost state creator helper なら `.create(...)` の中に残してください。
- 実際に使う imports だけを追加してください。
- リファクタリング後に typecheck と relevant tests を実行してください。

```md
Read this LLM context first and use it as the rules for this refactor:
https://raw.githubusercontent.com/zustandjs/zustand-middleware-pipe/refs/heads/main/docs/llm-context.md

この Zustand store を `zustand-middleware-pipe` を使う形にリファクタリングしてください。

- runtime behavior の preservation を最優先にしてください。
- middleware wrapper order を変えないでください: outermost wrapper が先、base creator が最後です。
- wrapper を同じ outside-to-inside order で `pipe.use(...)` に移してください。
- innermost state creator を `.create(...)` に入れてください。
- リファクタリング後に typecheck と relevant tests を実行してください。
```

単純で問題なく動いている store を、この helper のためだけに書き換える必要はありません。既存の middleware stack が読みにくい、または手作業で壊しやすい場合に LLM context を使ってください。

---

## インストール

```sh
npm install zustand-middleware-pipe zustand
```

`immer()` を使う場合だけ、追加で `immer` をインストールしてください:

```sh
npm install immer
```

`temporal()` を使う場合だけ、追加で `zundo` をインストールしてください:

```sh
npm install zundo
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
temporal<TState, UState = TState>(options?) // /middleware/zundo から使用
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
combine(initialState, creator)   // .create() の中で使用
redux(reducer, initialState)     // .create() の中で使用
```

### import パス

Core wrapper と storage helper は middleware barrel から import します。任意の adapter は専用 subpath に置くため、その peer package はその subpath を import するときだけ必要です:

```ts
import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'

import { immer } from 'zustand-middleware-pipe/middleware/immer'
import { temporal } from 'zustand-middleware-pipe/middleware/zundo'

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

### `zundo` temporal history

undo/redo history が必要な場合は zundo subpath を使います。`zundo` を別途インストールしてから、pipe に `temporal<CounterState>()` を追加します:

```ts
import { temporal } from 'zustand-middleware-pipe/middleware/zundo'

const useCounterStore = create<CounterState>()(
  pipe
    .use(temporal<CounterState>({ limit: 50 }))
    .create((set) => ({
      count: 0,
      inc: () => set((state) => ({ count: state.count + 1 })),
    })),
)

useCounterStore.temporal.getState().undo()
```

`temporal<CounterState>()` は `store.temporal` を含む zundo の mutator typing を維持します。型付きの options コールバックやミドルウェアの明示的な型から状態を推論できない場合は、最初の型引数に store 全体の状態を指定してください。後続の `.create(...)` は history の型を遡って推論しません。

部分的な history には `temporal<CounterState, Pick<CounterState, 'count'>>({ partialize: (state) => ({ count: state.count }) })` を使います。`pastStates` と `futureStates` は `Partial<UState>` の配列です。`partialize` は全体の状態、`equality` は `UState`、`diff` は `Partial<UState>` を受け取ります。adapter は upstream の options 宣言を維持します。zundo 2.3.0 は `onSave` を全体の状態として型付けしますが、`partialize` を使うと実際には部分的な状態を渡すため、このコールバックでは除外されたフィールドに依存しないでください。

全体の状態を推論する文脈がない `temporal()` は互換性のために維持しますが、history の状態が `unknown` になるため、エディターで deprecated と表示します。`{ limit: 50 }` のような options だけでも状態を推論できないため、`temporal<CounterState>({ limit: 50 })` を使ってください。`temporal<T>()` を返すジェネリックな factory、型を明示したコールバック、ミドルウェアの明示的な型の文脈は引き続きサポートします。

main store や temporal store を persist する場合は、zundo の `wrapTemporal` guidance に従ってください。この package は、すべての zundo + persistence 構成に対して単一の安全な順序を推論しません。

undo/redo history store 自体を persist したい場合は、`wrapTemporal` の中でもう一度 `pipe` を使えます:

```ts
import { pipe } from 'zustand-middleware-pipe'
import { createJSONStorage, persist } from 'zustand-middleware-pipe/middleware'
import {
  temporal,
  type TemporalState,
} from 'zustand-middleware-pipe/middleware/zundo'

type CounterHistory = TemporalState<CounterState>
type PersistedCounterHistory = Pick<CounterHistory, 'futureStates' | 'pastStates'>

pipe
  .use(
    temporal<CounterState>({
      wrapTemporal: (temporalCreator) =>
        pipe
          .use(
            persist<CounterHistory, PersistedCounterHistory>({
              name: 'counter-history',
              storage: createJSONStorage<PersistedCounterHistory>(() => localStorage),
              partialize: (history) => ({
                futureStates: history.futureStates,
                pastStates: history.pastStates,
              }),
            }),
          )
          .create(temporalCreator),
    }),
  )
  .create((set) => ({ ... }))
```

外側の `pipe` は main store を合成し、内側の `pipe` は zundo の temporal history store を合成します。

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

### userland middleware metadata

`definePipeableMiddleware` は、正しく型付けされた userland middleware に明示的な id と任意の policy metadata を付けます。この helper は同じ middleware 関数をそのまま返すため、Zustand mutator tuple の型は middleware 自体から維持されます:

```ts
const temporal = definePipeableMiddleware(temporalMiddleware, {
  id: 'zundo/temporal',
  duplicate: 'reject',
  order: {
    after: ['zustand/persist'],
    before: ['zustand/immer'],
  },
})

pipe
  .use(persist<CounterState>({ name: 'counter' }))
  .use(temporal)
  .use(immer())
  .create((set) => ({ ... }))
```

`order.before` と `order.after` は、現在の pipe chain に実際に存在する id に対してだけ検査されます。未知または存在しない target は無視され、cycle は拒否され、`zustand/persist` のような reserved built-in id は public userland metadata で再利用できません。

---

## 重要な caveat

- **公式 Zustand guidance ではありません。** これは userland の実験です。
- **すでに動いている store を書き直さないでください。**
- **Bundler resolution を前提とします。** この package は extensionless な内部相対 import を持つ ESM として emit されるため、bundler-compatible toolchain 経由で使用してください。
- **built-in wrapper の順序と重複は強制されます。** package が提供する wrapper は outer-to-inner の順で追加してください: `.use(devtools(...))` → `.use(subscribeWithSelector())` → `.use(persist(...))` → `.use(immer())`. TypeScript と runtime の `.use(...)` 境界は、逆順の built-in wrapper と重複した package built-in を拒否します。
- **runtime guard は tag 付きの pipeable wrapper に限定されます。** package built-in (`devtools`, `subscribeWithSelector`, `persist`, `immer`) と `zundo` のような opt-in adapter は、重複/順序検査用の明示的な metadata を持ちます。任意の untagged、userland、third-party middleware の順序や重複は introspect しません。
- **Userland order metadata は opt-in です。** `definePipeableMiddleware` は明示的な id と `order.before` / `order.after` hint だけを信頼します。関数名や source code は introspect せず、任意の third-party middleware を自動的に安全にするものではありません。
- **直接 reexport は Zustand helper の意味を保ちます。** `combine`, `redux`, `createJSONStorage` は直接の Zustand helper です。`combine` と `redux` は `.use(...)` ではなく `.create(...)` の中に置き、`immer` は引き続き専用の `zustand-middleware-pipe/middleware/immer` subpath から使います。
- **任意の third-party adapter は専用 subpath に置きます。** `zundo` は `zustand-middleware-pipe/middleware/zundo` から利用でき、consuming app 側で `zundo` のインストールが必要です。
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
npm run example:dev
```

`npm run example:dev` はサンプルを起動する前に local package を rebuild して link します。package root から `npm run example:verify` を実行すると、サンプルを build して lint します。

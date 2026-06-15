# zustand-middleware-pipe

[English](../../README.md) · [한국어](README.ko.md) · 日本語

Zustand のミドルウェアスタックを、実際に考える順番で書けるようにします。

`immer`、`persist`、`subscribeWithSelector`、`devtools` を 1 つの store に混ぜたことがあるなら、きっとこんな瞬間があったはずです。

> 「待って……この options ってどの middleware の設定だっけ？」

Zustand の通常の inside-out なミドルウェア記法は強力です。ただ、スタックが実際のアプリコードらしく厚くなってくると、コードは後ろ向きに読まされます。`persist` の options は真ん中にあり、`devtools` は外側からすべてを包み、`immer` は内側から `set` の型を変えます。次に読む人は、store setup を理解するために頭の中で括弧を 1 枚ずつ剥がさなければなりません。

`zustand-middleware-pipe` は同じ runtime behavior を保ったまま、setup を左から右へ読めるようにします。

1. typed pipe builder を開始する
2. Immer を追加する
3. Persist を追加する
4. selector subscription を追加する
5. DevTools を追加する
6. 最終的な `set` 型が反映された base state creator を書く

魔法の store replacement ではありません。新しい state model でもありません。密度の高い middleware stack をもう一度読みやすくする、小さな userland helper です。

この package は [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449) で議論されたアイデアをもとにしています。

## 問題: middleware stack は逆向きに読まされる

Zustand の middleware stack は通常 inside-out に書きます。

```ts
const store = createStore<CounterState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set) => ({
          count: 0,
          inc: () =>
            set((state) => {
              state.count += 1
            }),
        })),
        { name: 'counter' },
      ),
    ),
    { name: 'CounterStore' },
  ),
)
```

これは正しい Zustand code です。ただ、スタックが大きくなるほど形を追いづらくなり、runtime order はネストの中に隠れてしまいます。

## 解決: スタックを pipeline として書く

この helper を使うと、同じ runtime order を左から右へ書けます。

```ts
import { pipe } from 'zustand-middleware-pipe'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import {
  devtools,
  persist,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'

const store = createStore<CounterState>()(
  pipe<CounterState>()
    .use(immer())
    .use(persist<CounterState>({ name: 'counter' }))
    .use(subscribeWithSelector())
    .use(devtools({ name: 'CounterStore' }))
    .create((set) => ({
      count: 0,
      inc: () =>
        set(
          (state) => {
            state.count += 1
          },
          false,
          'counter/inc',
        ),
    })),
)
```

このコードは同じ nested middleware stack に評価されます。

```ts
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

`pipe` は middleware の順序を自動で並べ替えません。書いた `.use()`
順をそのまま適用します。前の `.use()` は base creator に近く、後の
`.use()` はそれまで作った stack を外側から包みます。そのため上の例では
`devtools()` を最後に置き、`devtools(...)` が outermost になる
Zustand の一般的な形を保っています。これは `devtools` をできるだけ遅く
置くという Zustand TypeScript guide の推奨と合います。built-in pipe wrapper
については、この順序を `pipe` API の契約として扱い、逆順は `.use(...)`
で拒否します。

## Install

```sh
npm install zustand-middleware-pipe zustand
```

`immer()` を使う場合だけ、追加で `immer` を install してください。

```sh
npm install immer
```

この package は ESM-only です。

## API

```ts
pipe<T>()
  .use(immer())
  .use(persist<T, PersistedState>(options))
  .use(subscribeWithSelector())
  .use(devtools(options?))
  .create(baseCreator)

definePipeStateCreator<T, Middlewares>(baseCreator)
pipe(base, ...wrappers)
pipeStateCreator(base, ...wrappers) // compatibility alias
immer()
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
```

`pipe<T>()` が primary API です。middleware list が唯一の source of truth になるため、base creator は builder chain から計算された `set` 型を受け取ります。`immer()` を使うと `.create(...)` の中で draft mutation が使え、`devtools(...)` を使うと action name 引数が使え、`subscribeWithSelector()` を使うと最終 store に selector subscribe overload が反映されます。

Immer 以外の wrapper は middleware barrel から import し、Immer は専用 subpath から import してください。

```ts
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import {
  devtools,
  persist,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
```

root entry point は middleware wrapper を import しません。middleware barrel も `immer` を import しないため、`persist`, `subscribeWithSelector`, `devtools` だけを使う consumer は optional Immer peer に触れません。wrapper 名は Zustand の元の middleware 名に意図的に合わせており、package subpath が pipe-aware 版であることを区別します。

`definePipeStateCreator<T, Middlewares>(baseCreator)` は既存の `pipe(...)` composition code 向けに残しています。新しい store では middleware list を builder chain だけで管理できる `pipe<T>()` を推奨します。

```ts
const store = createStore<CounterState>()(
  pipe<CounterState>()
    .use(persist<CounterState, Pick<CounterState, 'count'>>({
      name: 'counter',
      partialize: (state) => ({ count: state.count }),
    }))
    .use(subscribeWithSelector())
    .use(devtools({ name: 'CounterStore' }))
    .create((set) => ({
      count: 0,
      inc: () =>
        set((state) => ({ count: state.count + 1 }), false, 'counter/inc'),
    })),
)
```

builder chain 自体が type-safety contract です。`.use(immer())` を外すと `.create(...)` 内の draft mutation が type-check されません。`.use(devtools(...))` を外すと `set` に渡す action name 引数が type-check されません。

```ts
createStore<CounterState>()(
  pipe<CounterState>()
    // .use(immer()) // この middleware が抜けると creator 内で TypeScript error になります
    .use(persist<CounterState>({ name: 'counter' }))
    .create((set) => ({
      count: 0,
      inc: () =>
        set((state) => {
          state.count += 1
        }),
    })),
)
```

`persist` で `partialize` を使う場合は、persisted-state type を `persist` に渡してください。

```ts
persist<CounterState, Pick<CounterState, 'count'>>({
  name: 'counter',
  partialize: (state) => ({ count: state.count }),
})
```

## 重要な caveat

- これは **公式 Zustand guidance ではありません**。
- すでに動いている store を、この helper を使うためだけに書き換えないでください。
- built-in wrapper は inner から outer の順で追加してください。つまり `.use(immer())`, `.use(persist(...))`, `.use(subscribeWithSelector())`, `.use(devtools(...))` の順です。逆順の built-in wrapper は `.use(...)` で拒否されます。
- Zustand の devtools type は `store.devtools` を公開しますが、runtime property は通常の Zustand devtools behavior に依存します。たとえば devtools が無効化されている場合や Redux DevTools extension がない場合は、利用できないことがあります。
- `definePipeStateCreator` は compatibility API です。新しいコードでは `pipe<T>()` と unprefixed middleware wrapper を推奨します。
- 任意の third-party middleware composition は runtime `reduce` だけでは解決できません。wrapper には正しい mutator tuple type が必要です。

## Development

```sh
npm install
npm run verify
```

`npm run verify` は typecheck、Vitest、declaration build を実行します。

## Example

Vite React example は `examples/` にあり、local `file:..` dependency でこの package を使います。

```sh
npm run example:install
npm run example:dev
```

package root から `npm run example:verify` を実行すると、example を build して lint します。

# zustand-middleware-pipe

[English](../../README.md) · [한국어](README.ko.md) · 日本語

Zustand のミドルウェアスタックを、実際に考える順番で書けるようにします。

`immer`、`persist`、`subscribeWithSelector`、`devtools` を 1 つの store に混ぜたことがあるなら、きっとこんな瞬間があったはずです。

> 「待って……この options ってどの middleware の設定だっけ？」

Zustand の通常の inside-out なミドルウェア記法は強力です。ただ、スタックが実際のアプリコードらしく厚くなってくると、コードは後ろ向きに読まされます。`persist` の options は真ん中にあり、`devtools` は外側からすべてを包み、`immer` は内側から `set` の型を変えます。次に読む人は、store setup を理解するために頭の中で括弧を 1 枚ずつ剥がさなければなりません。

`zustand-middleware-pipe` は同じ runtime behavior を保ったまま、setup を左から右へ読めるようにします。

1. base creator を定義する
2. Immer を追加する
3. Persist を追加する
4. selector subscription を追加する
5. DevTools を追加する

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
const baseCreator = definePipeStateCreator<
  CounterState,
  'immer' | 'persist' | 'subscribeWithSelector' | 'devtools'
>((set) => ({
  count: 0,
  inc: () =>
    set(
      (state) => {
        state.count += 1
      },
      false,
      'counter/inc',
    ),
}))

const store = createStore<CounterState>()(
  pipe(
    baseCreator,
    withImmer(),
    withPersist<CounterState>({ name: 'counter' }),
    withSubscribeWithSelector(),
    withDevtools({ name: 'CounterStore' }),
  ),
)
```

このコードは同じ nested middleware stack に評価されます。

```ts
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

## Install

```sh
npm install zustand-middleware-pipe zustand immer
```

`immer` は現在 hard peer dependency です。root entry point が `withImmer()` を export し、module load 時に `zustand/middleware/immer` を import するためです。Immer を使わない consumer が install を避けられるようにするには、次の packaging step として `zustand-middleware-pipe/immer` のような別 entry point を分けるのがよさそうです。

この package は ESM-only です。

## API

```ts
definePipeStateCreator<T, Middlewares>(baseCreator)
pipe(base, ...wrappers)
pipeStateCreator(base, ...wrappers) // compatibility alias
withImmer()
withPersist<T, PersistedState = T, PersistReturn = unknown>(options)
withSubscribeWithSelector()
withDevtools(options?)
```

`pipe` が primary API で、最大 7 個の wrapper まで typed composition overload をサポートします。`pipeStateCreator` は PoC API が落ち着くまで残している compatibility alias です。middleware wrapper は、一般的な built-in middleware について Zustand v5 の mutator tuple type を保ちます。

`definePipeStateCreator<T, Middlewares>(baseCreator)` は、`pipe(...)` に渡す前の base state creator を定義するための typed identity helper です。Zustand の `create` や `createStore` を置き換えるものではありません。選択した built-in pipe stack type を base creator に与えることで、長い mutator tuple を手書きせずに middleware-specific な `set` overload を使えるようにします。使う middleware 名を union type として渡すと、helper が内部で Zustand の canonical mutator order にマッピングします。

```ts
const baseCreator = definePipeStateCreator<
  CounterState,
  'persist' | 'subscribeWithSelector' | 'devtools'
>((set) => ({
  count: 0,
  inc: () =>
    set((state) => ({ count: state.count + 1 }), false, 'counter/inc'),
}))

const store = createStore<CounterState>()(
  pipe(
    baseCreator,
    withPersist<CounterState>({ name: 'counter' }),
    withSubscribeWithSelector(),
    withDevtools({ name: 'CounterStore' }),
  ),
)
```

middleware union は type-safety contract でもあります。`definePipeStateCreator`
で `immer` を宣言しているのに `pipe(...)` で `withImmer()` を忘れると、
TypeScript はその stack を拒否します。base creator がまだ Immer mutator を
消費してもらうことを期待しているためです。逆方向の mismatch も拒否されます。
union から `immer` を外したまま `withImmer()` を追加すると、wrapper が期待する
input stack が変わってしまいます。

```ts
const baseCreator = definePipeStateCreator<
  CounterState,
  'immer' | 'persist'
>((set) => ({
  count: 0,
  inc: () =>
    set((state) => {
      state.count += 1
    }),
}))

createStore<CounterState>()(
  pipe(
    baseCreator,
    // withImmer(), // この wrapper が抜けると TypeScript error になります
    withPersist<CounterState>({ name: 'counter' }),
  ),
)
```

`persist` で `partialize` を使う場合は、partialized persisted-state type を明示してください。

```ts
withPersist<CounterState, Pick<CounterState, 'count'>>({
  name: 'counter',
  partialize: (state) => ({ count: state.count }),
})
```

## 重要な caveat

- これは **公式 Zustand guidance ではありません**。
- すでに動いている store を、この helper を使うためだけに書き換えないでください。
- `withDevtools(...)` は left-to-right list の最後に置いてください。そうすると `devtools(...)` が outermost になります。
- Zustand の devtools type は `store.devtools` を公開しますが、runtime property は通常の Zustand devtools behavior に依存します。たとえば devtools が無効化されている場合や Redux DevTools extension がない場合は、利用できないことがあります。
- TypeScript inference は、直接の `create(...middleware(...))` nesting より contextual でない場合があります。built-in middleware stack で base creator 内の typed Immer draft update や devtools action name が必要な場合は、`definePipeStateCreator<State, 'middlewareName' | ...>((set) => ...)` を使ってください。
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

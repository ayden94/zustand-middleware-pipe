# zustand-middleware-pipe

[English](../../README.md) · 한국어 · [日本語](README.ja.md)

Zustand 미들웨어 스택을 실제로 생각하는 순서대로 작성하세요.

`immer`, `persist`, `subscribeWithSelector`, `devtools`를 한 store에 섞어본 적이 있다면, 아마 이런 순간을 겪어봤을 겁니다.

> “잠깐... 이 옵션은 어떤 미들웨어 설정이었지?”

Zustand의 기본 inside-out 미들웨어 스타일은 강력합니다. 하지만 스택이 실제 서비스 코드처럼 두꺼워지는 순간, 코드는 거꾸로 읽히기 시작합니다. `persist` 옵션은 중간에 끼어 있고, `devtools`는 바깥에서 전체를 감싸고, `immer`는 안쪽에서 `set` 타입을 바꿉니다. 다음 사람이 store 설정을 이해하려면 머릿속으로 괄호를 하나씩 벗겨야 합니다.

`zustand-middleware-pipe`는 동일한 런타임 동작을 유지하면서 setup을 왼쪽에서 오른쪽으로 읽을 수 있게 합니다.

1. base creator를 정의하고
2. Immer를 추가하고
3. Persist를 추가하고
4. selector subscription을 추가하고
5. DevTools를 추가합니다

마법 같은 store 대체도 아니고, 새로운 상태 모델도 아닙니다. 빽빽한 미들웨어 스택을 다시 읽기 좋게 만드는 작은 userland helper입니다.

이 패키지는 [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449)에서 논의된 아이디어를 바탕으로 합니다. maintainer의 답변은 이 방향이 third-party/userland helper로는 괜찮지만, 현재 공식 Zustand 스타일로 권장되거나 문서화된 방식은 아니라는 내용이었습니다.

## 문제: 미들웨어 스택은 거꾸로 읽힙니다

Zustand 미들웨어 스택은 보통 inside-out으로 작성합니다.

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

올바른 Zustand 코드입니다. 하지만 스택이 커질수록 형태를 훑어보기 어려워지고, 실제 런타임 순서는 중첩 안에 숨어버립니다.

## 해결: 스택을 pipeline처럼 작성하기

이 helper를 쓰면 같은 런타임 순서를 왼쪽에서 오른쪽으로 작성할 수 있습니다.

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

위 코드는 다음과 같은 nested middleware stack으로 평가됩니다.

```ts
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

## 설치

```sh
npm install zustand-middleware-pipe zustand immer
```

`immer`는 현재 hard peer dependency입니다. root entry point가 `withImmer()`를 export하고 module load 시점에 `zustand/middleware/immer`를 import하기 때문입니다. Immer를 사용하지 않는 소비자가 설치를 피하게 하려면, 다음 packaging 단계에서 별도 `zustand-middleware-pipe/immer` entry point를 분리하는 것이 좋습니다.

이 패키지는 ESM-only입니다.

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

`pipe`가 primary API이며, 최대 7개의 wrapper까지 typed composition overload를 지원합니다. `pipeStateCreator`는 PoC API가 안정화되는 동안 유지하는 compatibility alias입니다. middleware wrapper들은 일반적인 built-in middleware에 대해 Zustand v5의 mutator tuple type을 보존합니다.

`definePipeStateCreator<T, Middlewares>(baseCreator)`는 `pipe(...)`에 넘기기 전 base state creator를 정의하기 위한 typed identity helper입니다. Zustand의 `create`나 `createStore`를 대체하지 않습니다. 단지 선택한 built-in pipe stack type을 base creator에 부여해서, middleware-specific `set` overload를 긴 mutator tuple 없이 사용할 수 있게 합니다. 사용하는 middleware 이름을 union type으로 넘기면, helper가 내부에서 Zustand의 canonical mutator order로 매핑합니다.

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

middleware union은 type-safety contract이기도 합니다. `definePipeStateCreator`에
`immer`를 선언해놓고 `pipe(...)`에서 `withImmer()`를 빼먹으면, TypeScript가
stack을 거부합니다. base creator가 아직 Immer mutator가 소비되기를 기대하기
때문입니다. 반대 방향의 mismatch도 거부됩니다. union에서 `immer`를 빼놓고
`withImmer()`를 추가하면 wrapper가 기대하는 input stack이 달라집니다.

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
    // withImmer(), // 이 wrapper가 빠지면 TypeScript error가 발생합니다
    withPersist<CounterState>({ name: 'counter' }),
  ),
)
```

`persist`에서 `partialize`를 사용한다면, partialized persisted-state type을 명시적으로 넘기세요.

```ts
withPersist<CounterState, Pick<CounterState, 'count'>>({
  name: 'counter',
  partialize: (state) => ({ count: state.count }),
})
```

## 중요한 caveat

- 이것은 **공식 Zustand guidance가 아닙니다**.
- 이미 잘 동작하는 store를 이 helper를 쓰기 위해 억지로 다시 작성하지 마세요.
- `withDevtools(...)`는 left-to-right list의 마지막에 두세요. 그래야 `devtools(...)`가 outermost가 됩니다.
- Zustand의 devtools type은 `store.devtools`를 노출하지만, runtime property는 일반적인 Zustand devtools 동작에 의존합니다. 예를 들어 devtools가 비활성화되어 있거나 Redux DevTools extension이 없다면 사용할 수 없을 수 있습니다.
- TypeScript inference는 직접적인 `create(...middleware(...))` nesting보다 contextual하지 않을 수 있습니다. built-in middleware stack에서 base creator 내부의 typed Immer draft update나 devtools action name이 필요하다면 `definePipeStateCreator<State, 'middlewareName' | ...>((set) => ...)`를 사용하세요.
- 임의의 third-party middleware composition은 runtime `reduce`만으로 해결되지 않습니다. wrapper에는 올바른 mutator tuple type이 필요합니다.

## 개발

```sh
npm install
npm run verify
```

`npm run verify`는 typecheck, Vitest, declaration build를 실행합니다.

## 예제

Vite React 예제는 `examples/`에 있으며, local `file:..` dependency로 이 패키지를 사용합니다.

```sh
npm run example:install
npm run example:dev
```

패키지 root에서 `npm run example:verify`를 실행하면 예제를 build하고 lint합니다.

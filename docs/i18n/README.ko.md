# zustand-middleware-pipe

[English](../../README.md) · 한국어 · [日本語](README.ja.md)

Zustand 미들웨어 스택을 실제로 생각하는 순서대로 작성하세요.

`immer`, `persist`, `subscribeWithSelector`, `devtools`를 한 store에 섞어본 적이 있다면, 아마 이런 순간을 겪어봤을 겁니다.

> “잠깐... 이 옵션은 어떤 미들웨어 설정이었지?”

Zustand의 기본 inside-out 미들웨어 스타일은 강력합니다. 하지만 스택이 실제 서비스 코드처럼 두꺼워지는 순간, 코드는 거꾸로 읽히기 시작합니다. `persist` 옵션은 중간에 끼어 있고, `devtools`는 바깥에서 전체를 감싸고, `immer`는 안쪽에서 `set` 타입을 바꿉니다. 다음 사람이 store 설정을 이해하려면 머릿속으로 괄호를 하나씩 벗겨야 합니다.

`zustand-middleware-pipe`는 동일한 런타임 동작을 유지하면서 setup을 왼쪽에서 오른쪽으로 읽을 수 있게 합니다.

1. typed pipe builder를 시작하고
2. Immer를 추가하고
3. Persist를 추가하고
4. selector subscription을 추가하고
5. DevTools를 추가하고
6. 최종 `set` 타입이 반영된 base state creator를 작성합니다

마법 같은 store 대체도 아니고, 새로운 상태 모델도 아닙니다. 빽빽한 미들웨어 스택을 다시 읽기 좋게 만드는 작은 userland helper입니다.

이 패키지는 [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449)에서 논의된 아이디어를 바탕으로 합니다.

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
import { pipe } from 'zustand-middleware-pipe'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import {
  devtools,
  persist,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'

const store = createStore<CounterState>()(
  pipe.use(immer())
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

위 코드는 다음과 같은 nested middleware stack으로 평가됩니다.

```ts
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

`pipe`가 middleware 순서를 자동으로 정렬하지는 않습니다. 작성한
`.use()` 순서를 그대로 적용합니다. 앞쪽 `.use()`는 base creator에 더
가깝고, 뒤쪽 `.use()`는 지금까지 만든 stack을 바깥에서 감쌉니다. 그래서
위 예시는 `devtools()`를 마지막에 두어 `devtools(...)`가 outermost인,
Zustand의 일반적인 형태를 유지합니다. 이는 `devtools`를 가능한 늦게 두라는
Zustand TypeScript guide의 권장과 맞습니다. built-in pipe wrapper에 대해서는
이 순서가 `pipe` API 계약이며, 뒤집힌 순서는 `.use(...)`에서 거부됩니다.

## 설치

```sh
npm install zustand-middleware-pipe zustand
```

`immer()`를 사용할 때만 `immer`를 추가로 설치하세요.

```sh
npm install immer
```

이 패키지는 ESM-only입니다.

## API

```ts
pipe.use(immer())
  .use(persist<T, PersistedState>(options))
  .use(subscribeWithSelector())
  .use(devtools(options?))
  .create(baseCreator)

immer()
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
```

`pipe.use(...)`가 primary API입니다. middleware list가 유일한 source of truth가 되므로, base creator는 builder chain에서 계산된 `set` 타입을 받습니다. `immer()`를 사용하면 `.create(...)` 안에서 draft mutation이 가능하고, `devtools(...)`를 사용하면 action name 인자가 열리며, `subscribeWithSelector()`를 사용하면 최종 store에 selector subscribe overload가 반영됩니다.

Immer를 제외한 wrapper는 middleware barrel에서 import하고, Immer는 전용 subpath에서 import하세요.

```ts
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import {
  devtools,
  persist,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
```

root entry point는 middleware wrapper를 import하지 않습니다. middleware barrel도 `immer`를 import하지 않으므로, `persist`, `subscribeWithSelector`, `devtools`만 쓰는 소비자는 optional Immer peer를 건드리지 않습니다. wrapper 이름은 Zustand의 원본 middleware 이름을 의도적으로 따르며, package subpath가 pipe-aware 버전을 구분합니다.

```ts
const store = createStore<CounterState>()(
  pipe.use(persist<CounterState, Pick<CounterState, 'count'>>({
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

builder chain 자체가 type-safety contract입니다. `.use(immer())`를 제거하면 `.create(...)` 안의 draft mutation이 type-check되지 않습니다. `.use(devtools(...))`를 제거하면 `set`에 넘기는 action name 인자가 type-check되지 않습니다.

```ts
createStore<CounterState>()(
  pipe
    // .use(immer()) // 이 middleware가 빠지면 creator 안에서 TypeScript error가 발생합니다
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

`persist`에서 `partialize`를 사용한다면 persisted-state type을 `persist`에 넘기세요.

```ts
persist<CounterState, Pick<CounterState, 'count'>>({
  name: 'counter',
  partialize: (state) => ({ count: state.count }),
})
```

## 중요한 caveat

- 이것은 **공식 Zustand guidance가 아닙니다**.
- 이미 잘 동작하는 store를 이 helper를 쓰기 위해 억지로 다시 작성하지 마세요.
- built-in wrapper는 inner에서 outer 순서로 추가해야 합니다. 즉 `.use(immer())`, `.use(persist(...))`, `.use(subscribeWithSelector())`, `.use(devtools(...))` 순서입니다. 뒤집힌 built-in 순서는 `.use(...)`에서 거부됩니다.
- Zustand의 devtools type은 `store.devtools`를 노출하지만, runtime property는 일반적인 Zustand devtools 동작에 의존합니다. 예를 들어 devtools가 비활성화되어 있거나 Redux DevTools extension이 없다면 사용할 수 없을 수 있습니다.
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

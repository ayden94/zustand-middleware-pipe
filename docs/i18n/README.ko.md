# zustand-middleware-pipe

[English](../../README.md) · 한국어 · [日本語](README.ja.md)

[![npm version](https://img.shields.io/npm/v/zustand-middleware-pipe)](https://www.npmjs.com/package/zustand-middleware-pipe)
[![license](https://img.shields.io/npm/l/zustand-middleware-pipe)](../../LICENSE)
[![ESM only](https://img.shields.io/badge/ESM-only-blue)](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

Zustand 미들웨어 스택을 실제로 생각하는 순서대로 작성하세요.

## 빠른 시작

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
    .use(immer())
    .use(persist<CounterState>({ name: 'counter' }))
    .use(subscribeWithSelector())
    .use(devtools({ name: 'CounterStore' }))
    .create((set) => ({
      count: 0,
      inc: () => set((state) => { state.count += 1 }, false, 'counter/inc'),
    })),
)
```

이게 전부입니다. 마법 같은 store 대체도 아니고, 새로운 상태 모델도 아닙니다. 빽빽한 미들웨어 스택을 다시 읽기 좋게 만드는 작은 userland helper입니다.

이 패키지는 [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449)에서 논의된 아이디어를 바탕으로 합니다.

---

## 문제: 미들웨어 스택은 거꾸로 읽힙니다

Zustand 미들웨어는 inside-out으로 작성합니다. 가장 안쪽 호출이 base creator이고, 가장 바깥쪽 호출이 런타임에서 마지막으로 적용되는 미들웨어입니다. 미들웨어가 네 개 쌓이면, 형태가 뒤집힙니다:

```ts
// 런타임 순서: immer → persist → subscribeWithSelector → devtools
// 작성 순서:   devtools(subscribeWithSelector(persist(immer(...)))) ← 거꾸로
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

옵션은 여기저기 흩어집니다. `persist` 옵션은 중간에 묻히고, `devtools` 옵션은 파일 아래에 떨어져 있고, 다음 사람은 store 구조를 이해하려면 모든 레이어를 머릿속으로 벗겨내야 합니다.

## 해결: 스택을 pipeline처럼 작성하기

`pipe`를 쓰면 같은 런타임 순서를 왼쪽에서 오른쪽으로 작성할 수 있습니다:

```ts
// 작성 순서 = 런타임 순서 ↓
pipe
  .use(immer())
  .use(persist<CounterState>({ name: 'counter' }))
  .use(subscribeWithSelector())
  .use(devtools({ name: 'CounterStore' }))
  .create((set) => ({ ... }))
```

### Before / After 비교

| | Before (inside-out) | After (pipe) |
|---|---|---|
| **읽는 순서** | 바깥쪽 wrapper부터, base creator가 마지막 | 적용 순서 그대로 왼쪽에서 오른쪽 |
| **옵션 위치** | 중첩 레이어 곳곳에 흩어짐 | 각 `.use(...)` 호출 안에 인라인 |
| **`set` 타입** | 중첩 구조에서 추론 | builder chain이 누적하여 계산 |
| **미들웨어 추가** | 전체 표현식을 다시 감쌈 | 올바른 위치에 `.use(...)` 추가 |

평가 결과는 동일합니다:

```ts
// pipe는 런타임에서 이것과 정확히 동일합니다
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

---

## 설치

```sh
npm install zustand-middleware-pipe zustand
```

`immer()`를 스택에 포함할 때만 `immer`를 추가로 설치하세요:

```sh
npm install immer
```

이 패키지는 **ESM-only**입니다.

---

## API

```ts
pipe.use(immer())
  .use(persist<T, PersistedState>(options))
  .use(subscribeWithSelector())
  .use(devtools(options?))
  .create(baseCreator)
```

### 미들웨어 wrapper

```ts
immer()
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
combine(initialState, creator)   // .create() 안에서 사용
redux(reducer, initialState)     // .create() 안에서 사용
```

### import 경로

Immer를 제외한 wrapper는 middleware barrel에서 import합니다. Immer는 optional peer로 유지하기 위해 전용 subpath를 사용합니다:

```ts
import { pipe } from 'zustand-middleware-pipe'

import { immer } from 'zustand-middleware-pipe/middleware/immer'

import {
  combine,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
```

### builder chain의 타입 안전성

`pipe.use(...)`는 미들웨어를 추가할 때마다 mutator 타입을 누적합니다. 최종 `.create(baseCreator)`는 완전히 조합된 `set` 타입을 받으므로, TypeScript가 각 미들웨어의 기여를 검사합니다:

- `.use(immer())` → `.create(...)` 안에서 draft mutation이 유효해짐
- `.use(devtools(...))` → `set`의 세 번째 인자로 action name을 넘길 수 있음
- `.use(subscribeWithSelector())` → store에 selector subscribe overload가 반영됨

`.use(...)` 호출을 제거하면, 그에 해당하는 기능이 타입에서 즉시 사라집니다:

```ts
create<CounterState>()(
  pipe
    // .use(immer()) ← 이 줄을 제거하면 아래 draft mutation이 TypeScript 에러
    .use(persist<CounterState>({ name: 'counter' }))
    .create((set) => ({
      count: 0,
      inc: () =>
        set((state) => {
          state.count += 1 // ← 에러: set은 여기서 함수를 받지 않음
        }),
    })),
)
```

### `persist`와 부분 상태

`partialize`를 사용할 때는 두 번째 제네릭으로 persisted-state 타입을 전달하세요:

```ts
pipe
  .use(persist<CounterState, Pick<CounterState, 'count'>>({
    name: 'counter',
    partialize: (state) => ({ count: state.count }),
  }))
  .use(subscribeWithSelector())
  .use(devtools({ name: 'CounterStore' }))
  .create((set) => ({
    count: 0,
    inc: () => set((state) => ({ count: state.count + 1 }), false, 'counter/inc'),
  }))
```

### `combine`과 `redux`

`combine`과 `redux`는 미들웨어가 아닌 Zustand state-creator helper이므로 `.create(...)` 안에 둡니다:

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

## 중요한 caveat

- **공식 Zustand guidance가 아닙니다.** 이것은 userland 실험입니다.
- **이미 잘 동작하는 store는 다시 작성하지 마세요.**
- **built-in wrapper 순서는 강제됩니다.** inner-to-outer 순서로 추가해야 합니다: `.use(immer())` → `.use(persist(...))` → `.use(subscribeWithSelector())` → `.use(devtools(...))`. 뒤집힌 built-in 순서는 `.use(...)`에서 거부됩니다.
- **`store.devtools` 가용성**은 일반적인 Zustand devtools 동작에 의존합니다. devtools가 비활성화되어 있거나 Redux DevTools extension이 없다면 사용할 수 없을 수 있습니다.
- **서드파티 미들웨어**는 자동으로 조합되지 않습니다. builder와 함께 동작하려면 wrapper에 올바른 mutator tuple 타입이 필요합니다.

---

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

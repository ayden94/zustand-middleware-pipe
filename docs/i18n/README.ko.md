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
import { definePipeableMiddleware, pipe } from 'zustand-middleware-pipe'
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

이게 전부입니다. 마법 같은 store 대체도 아니고, 새로운 상태 모델도 아닙니다. 빽빽한 미들웨어 스택을 다시 읽기 좋게 만드는 작은 userland helper입니다.

이 패키지는 [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449)에서 논의된 아이디어를 바탕으로 합니다.

---

## 문제: 미들웨어 스택은 거꾸로 읽힙니다

Zustand 미들웨어는 base creator를 감싸는 중첩 wrapper로 작성합니다. 가장 바깥쪽 wrapper는 잘 보이지만, base creator는 가장 깊은 곳에 묻힙니다. 미들웨어가 네 개 쌓이면 옵션과 상태 로직이 여러 들여쓰기 레벨에 흩어집니다:

```ts
// wrapper 순서: devtools → subscribeWithSelector → persist → immer → base creator
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

`pipe`를 쓰면 같은 wrapper stack을 위에서 아래로, base creator를 마지막에 두고 작성할 수 있습니다:

```ts
// 작성 순서 = 중첩 wrapper 표현식 순서 ↓
pipe
  .use(devtools({ name: 'CounterStore' }))
  .use(subscribeWithSelector())
  .use(persist<CounterState>({ name: 'counter' }))
  .use(immer())
  .create((set) => ({ ... }))
```

### Before / After 비교

| | Before (inside-out) | After (pipe) |
|---|---|---|
| **읽는 순서** | 바깥쪽 wrapper부터, base creator는 가장 깊이 묻힘 | 위에서 아래로 읽고 `.create(...)`에서 끝남 |
| **옵션 위치** | 중첩 레이어 곳곳에 흩어짐 | 각 `.use(...)` 호출 안에 인라인 |
| **`set` 타입** | 중첩 구조에서 추론 | builder chain이 누적하여 계산 |
| **미들웨어 추가** | 전체 표현식을 다시 감쌈 | 대응되는 wrapper 위치에 `.use(...)` 삽입 |

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

`temporal()`을 스택에 포함할 때만 `zundo`를 추가로 설치하세요:

```sh
npm install zundo
```

이 패키지는 **ESM-only**이며 내부 상대 import에는 bundler-style module resolution을 전제로 합니다.

---

## API

```ts
pipe.use(devtools(options?))
  .use(subscribeWithSelector())
  .use(persist<T, PersistedState>(options))
  .use(immer())
  .create(baseCreator)
```

### 미들웨어 wrapper

```ts
immer()
temporal(options?)              // /middleware/zundo에서 사용
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
combine(initialState, creator)   // .create() 안에서 사용
redux(reducer, initialState)     // .create() 안에서 사용
```

### import 경로

Core wrapper와 storage helper는 middleware barrel에서 import합니다. 선택적 adapter는 전용 subpath에 두므로, 해당 peer package는 그 subpath를 import할 때만 필요합니다:

```ts
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

### builder chain의 타입 안전성

`pipe.use(...)`는 미들웨어를 추가할 때마다 mutator 타입을 누적합니다. 최종 `.create(baseCreator)`는 완전히 조합된 `set` 타입을 받으므로, TypeScript가 각 미들웨어의 기여를 검사합니다:

- `.use(immer())` → `.create(...)` 안에서 draft mutation이 유효해짐
- `.use(devtools(...))` → `set`의 세 번째 인자로 action name을 넘길 수 있음
- `.use(subscribeWithSelector())` → store에 selector subscribe overload가 반영됨

`.use(...)` 호출을 제거하면, 그에 해당하는 기능이 타입에서 즉시 사라집니다:

```ts
create<CounterState>()(
  pipe
    .use(persist<CounterState>({ name: 'counter' }))
    // .use(immer()) ← 이 줄을 제거하면 아래 draft mutation이 TypeScript 에러
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

undo/redo history가 필요하면 zundo subpath를 사용하세요. `zundo`를 별도로 설치한 뒤 pipe에 `temporal()`을 추가합니다:

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

`temporal()`은 `store.temporal`을 포함한 zundo의 mutator typing을 유지합니다. main store나 temporal store를 함께 persist한다면 zundo의 `wrapTemporal` 가이드를 따르세요. 이 패키지는 모든 zundo + persistence 조합에 대해 하나의 보편적인 안전 순서를 추론하지 않습니다.

undo/redo history store 자체를 persist하고 싶다면 `wrapTemporal` 안에서도 다시 `pipe`를 사용할 수 있습니다:

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

바깥 `pipe`는 main store를 조합하고, 안쪽 `pipe`는 zundo의 temporal history store를 조합합니다.

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

### userland 미들웨어 metadata

`definePipeableMiddleware`는 올바르게 타입이 지정된 userland 미들웨어에 명시적인 id와 선택적 정책 metadata를 붙입니다. 이 helper는 같은 미들웨어 함수를 그대로 반환하므로, Zustand mutator tuple 타입은 미들웨어 자체에서 유지됩니다:

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

`order.before`와 `order.after`는 현재 pipe chain에 실제로 존재하는 id에 대해서만 검사됩니다. 알 수 없거나 없는 target은 무시되며, cycle은 거부되고 `zustand/persist` 같은 reserved built-in id는 public userland metadata에서 재사용할 수 없습니다.

---

## 중요한 caveat

- **공식 Zustand guidance가 아닙니다.** 이것은 userland 실험입니다.
- **이미 잘 동작하는 store는 다시 작성하지 마세요.**
- **Bundler resolution을 전제로 합니다.** 이 패키지는 extensionless 내부 상대 import를 가진 ESM으로 emit되므로, bundler-compatible toolchain을 통해 사용하세요.
- **built-in wrapper 순서와 중복은 강제됩니다.** 패키지가 제공하는 wrapper는 outer-to-inner 순서로 추가해야 합니다: `.use(devtools(...))` → `.use(subscribeWithSelector())` → `.use(persist(...))` → `.use(immer())`. TypeScript와 런타임 `.use(...)` 경계는 뒤집힌 built-in 순서와 중복된 패키지 built-in을 거부합니다.
- **런타임 guard는 tag가 붙은 pipeable wrapper에 한정됩니다.** 패키지 built-in(`devtools`, `subscribeWithSelector`, `persist`, `immer`)과 `zundo` 같은 opt-in adapter는 중복/순서 검사용 명시적 metadata를 가집니다. 임의의 untagged, userland, 서드파티 미들웨어는 순서나 중복을 introspect하지 않습니다.
- **Userland order metadata는 opt-in입니다.** `definePipeableMiddleware`는 명시적인 id와 `order.before` / `order.after` hint만 신뢰합니다. 함수 이름이나 source code를 introspect하지 않으며, 임의의 서드파티 미들웨어를 자동으로 안전하게 만들지 않습니다.
- **직접 reexport는 Zustand helper 의미를 유지합니다.** `combine`, `redux`, `createJSONStorage`는 직접 Zustand helper입니다. `combine`과 `redux`는 `.use(...)`가 아니라 `.create(...)` 안에 두며, `immer`는 계속 전용 `zustand-middleware-pipe/middleware/immer` subpath에서 사용합니다.
- **선택적 서드파티 adapter는 전용 subpath에 둡니다.** `zundo`는 `zustand-middleware-pipe/middleware/zundo`에서 사용할 수 있으며, consuming app에 `zundo` 설치가 필요합니다.
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

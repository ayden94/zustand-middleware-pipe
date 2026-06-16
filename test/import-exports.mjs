import assert from 'node:assert/strict'

import { createStore } from 'zustand/vanilla'

import * as root from 'zustand-middleware-pipe'
import * as middleware from 'zustand-middleware-pipe/middleware'
import * as immerModule from 'zustand-middleware-pipe/middleware/immer'

function createMemoryStorage() {
  const values = new Map()

  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value)
    },
    removeItem: (name) => {
      values.delete(name)
    },
  }
}

assert.deepEqual(Object.keys(root).sort(), ['pipe'])
assert.deepEqual(Object.keys(middleware).sort(), [
  'combine',
  'createJSONStorage',
  'devtools',
  'persist',
  'redux',
  'subscribeWithSelector',
])
assert.deepEqual(Object.keys(immerModule).sort(), ['immer'])

const observed = []
const store = createStore()(
  root.pipe
    .use(middleware.devtools({ name: 'PackageConsumerStore', enabled: false }))
    .use(middleware.subscribeWithSelector())
    .use(
      middleware.persist({
        name: 'package-consumer-smoke-test',
        storage: middleware.createJSONStorage(() => createMemoryStorage()),
        partialize: (state) => ({ count: state.count }),
      }),
    )
    .use(immerModule.immer())
    .create((set) => ({
      count: 0,
      inc: () => {
        set(
          (state) => {
            state.count += 1
          },
          false,
          'counter/inc',
        )
      },
    })),
)

const unsubscribe = store.subscribe(
  (state) => state.count,
  (count, previousCount) => {
    observed.push([count, previousCount])
  },
)

store.getState().inc()
store.setState({ count: 2 }, false, 'counter/setCount')

assert.equal(store.getState().count, 2)
assert.deepEqual(observed, [
  [1, 0],
  [2, 1],
])
assert.equal(store.persist.hasHydrated(), true)

unsubscribe()

import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'
import { devtools, redux } from 'zustand-middleware-pipe/middleware'

type ReduxCounterAction =
  | { type: 'decrement' }
  | { type: 'increment' }
  | { type: 'reset' }

interface ReduxCounterState {
  count: number
}

export type ReduxCounterStore = ReduxCounterState & {
  dispatch: (action: ReduxCounterAction) => ReduxCounterAction
}

const reduxCounterReducer = (
  state: ReduxCounterState,
  action: ReduxCounterAction,
): ReduxCounterState => {
  switch (action.type) {
    case 'decrement':
      return { count: state.count - 1 }
    case 'increment':
      return { count: state.count + 1 }
    case 'reset':
      return { count: 0 }
  }
}

export const useReduxCounterStore = create<ReduxCounterStore>()(
  pipe
    .use(devtools({ name: 'ReduxCounterExample', enabled: false }))
    .create(redux(reduxCounterReducer, { count: 0 })),
)

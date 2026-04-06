# Scorva — Frontend Testing Quick Reference

Framework: **Vitest + Testing Library + jsdom**
Full backend guide: [`backend/__tests__/README.md`](../backend/__tests__/README.md)

## Setup files
- Test setup: `frontend/src/__tests__/setup.js`
- Test helpers: `frontend/src/__tests__/helpers/testUtils.jsx` — `renderWithProviders`, `mockSession`
- TQ wrapper: `frontend/src/__tests__/helpers/queryWrapper.jsx` — `createWrapper()`, `createTestQueryClient()`
- All tests: `frontend/src/__tests__/`

## Patterns

- **API client tests** — mock `global.fetch` via `vi.stubGlobal`; stub `import.meta.env.VITE_API_URL` via `vi.stubEnv`
- **API wrapper tests** — mock `../../api/client.js` via `vi.mock()`
- **Hook tests (TanStack Query)** — all data/user/AI hooks require a `QueryClientProvider`; use `createWrapper()` from `queryWrapper.jsx` as the `wrapper` option to `renderHook`. Mock API modules + `AuthContext.jsx`; use `waitFor` + `act`.
  ```js
  import { createWrapper } from "../helpers/queryWrapper.jsx";
  const { result } = renderHook(() => useGame("nba", 1), { wrapper: createWrapper() });
  ```
- `createTestQueryClient()` sets `retry: false`, `gcTime: 0`, `staleTime: 0` — each `createWrapper()` call builds a fresh client so tests are isolated
- **Debounce tests** — `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(ms)` + `await act(async () => {})` — do NOT use `waitFor` with fake timers (it polls via real `setTimeout` internally, which never advances)
- **Component tests** — use `renderWithProviders` from `testUtils.jsx` for components that need router/auth context

## Commands
```bash
cd frontend && npm test              # run all tests
cd frontend && npm run test:watch    # watch mode
cd frontend && npm run test:coverage # coverage report
```

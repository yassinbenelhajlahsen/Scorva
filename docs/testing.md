# Scorva — Frontend Testing Quick Reference

Framework: **Vitest + Testing Library + jsdom**
Full backend guide: [`backend/__tests__/README.md`](../backend/__tests__/README.md)

## Setup files
- Test setup: `frontend/src/__tests__/setup.js`
- Test helpers: `frontend/src/__tests__/helpers/testUtils.jsx`
- All tests: `frontend/src/__tests__/`

## Patterns

- **API client tests** — mock `global.fetch` via `vi.stubGlobal`; stub `import.meta.env.VITE_API_URL` via `vi.stubEnv`
- **API wrapper tests** — mock `../../api/client.js` via `vi.mock()`
- **Hook tests** — mock `AuthContext.jsx` + API modules; use `renderHook` + `waitFor` + `act`
- **Debounce tests** — `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(ms)` + `await act(async () => {})` — do NOT use `waitFor` with fake timers (it polls via real `setTimeout` internally, which never advances)
- **Component tests** — use `renderWithProviders` from `testUtils.jsx` for components that need router/auth context

## Commands
```bash
cd frontend && npm test              # run all tests
cd frontend && npm run test:watch    # watch mode
cd frontend && npm run test:coverage # coverage report
```

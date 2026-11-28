# Giving the agent a browser

Drive the running app with `agent-browser` and answer yes or no from the DOM. Use screenshots only as PR evidence.

The sandbox image has `agent-browser` and one Chromium, shared with Playwright through `AGENT_BROWSER_EXECUTABLE_PATH`. Outside the sandbox, run `npm install -g agent-browser@0.43.0` and `agent-browser install` once.

## Workflow

1. Start the dev server in the background: `npm run dev &`.
2. Wait for it: `until curl -sf http://localhost:5173 >/dev/null; do sleep 0.5; done`.
3. Do a throwaway load first (trap 2).
4. `agent-browser open 'http://localhost:5173/?fixtures'`.
5. Wait for what you expect to appear, not for idle: `agent-browser wait --text 'Demo: swap'`.
6. Read the DOM: `agent-browser get text 'nav'`, `agent-browser snapshot`, `agent-browser get count 'li'`.
7. Interact with refs from `snapshot`, e.g. `agent-browser click @e3`, then read the DOM again.
8. Stop the dev server when done.

## Screenshots for the PR

Take one before your change (`git stash` or the base branch) and one after: `agent-browser screenshot before.png`. Keep them outside the repository, and describe each in the PR body.

## Traps

1. **Hydration lags "networkidle".** The page can be idle before React has attached its handlers, so a first click may do nothing. Wait for the effect you expect and click again if it doesn't appear.
2. **Vite re-optimizes on first load.** It can reload the page mid-interaction. Open the page once and wait for it to settle before the real run.

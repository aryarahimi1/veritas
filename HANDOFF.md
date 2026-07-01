# Veritas — submission handoff

The win-track engineering (Phases 9–14 in [PLAN.md](./PLAN.md)) is **done, committed, and verified** on branch
`feat/win-track` (merged to `main`). What remains are the **outward-facing, irreversible steps that need your
accounts** — deliberately left for you.

## What's done (verified)

| Phase | What | Verified by |
|---|---|---|
| 9 | Cached-fallback contradiction killed (retry-first; cached is opt-in and self-consistent; slider locks) | build · cached-commitment self-consistency check · adversarial Code-Review (found+fixed a slider gap) |
| 10 | Live-proving reliability (prewarm, retry, optional faucet, status dot) | build · logic review |
| 11 | Proof bound to a real Stellar payment (payment ↦ compliance, one settlement id) | build · settlementRef-consistency check · adversarial review |
| 12 | Positioning ($4.3B lede, why-Stellar, one-liner) | build |
| 13 | Static SPA build config (adapter-static, vercel.json, no COOP/COEP) | static build emits index.html + assets |
| 14 | Fresh-tx indexing gate + link sweep | build · link checker 6/6 = 200 |

`cargo test` 10/10 · `npm run build` clean · `scripts/check-links.mjs` clean.

> **One honest caveat:** this build sandbox can't reach Friendbot / Soroban-RPC / Horizon, so the **live**
> proving + real-payment paths were verified by logic, build, and a real-tx e2e *test that you run*, not executed
> here. Please run the local check below once — it exercises the whole live path on your network.

## Do this first — local verification (2 commands)

```bash
# 1) the real end-to-end live path (funds, sends a settlement payment, proves, anchors, asserts one settlement id)
cd web && node live-test.mjs        # expect: PASS + two stellar.expert links

# 2) the demo itself
npm run dev                          # open the URL; TESTNET dot should go green
```

In the browser, sanity-check the demo-integrity fix: set the slider to **$500**, throttle/kill your network in
devtools, click **Generate** → you should get the **Retry live** card (never a blank screen, never a contradicting
number). Restore network, **Retry live** → live run with the payment ↦ compliance links. Click **try to forge it**
→ `#3 ProofInvalid` on-chain.

## Step 1 — deploy the demo (needs your Vercel account)

The app is a static SPA (`web/`, output `build/`), configured in `web/vercel.json`.

```bash
cd web
npx vercel        # first run links/creates the project — set the Root Directory to web/
npx vercel --prod # production URL
```

Then, on the **deployed origin**, confirm: the page proves in-browser and anchors a live tx (this is the one thing
only a real deployment can confirm — proving on the deployed origin, not just localhost). If Friendbot rate-limits
during a demo, set `VITE_DEMO_FUND_SECRET` (a funded testnet seed) in Vercel env to keep runs live. See
`web/.env.example` for all knobs. **Do not** add COOP/COEP headers — they break the Stellar fetches.

## Step 2 — public repo (needs your GitHub account)

```bash
gh repo create veritas --public --source=. --remote=origin --push   # gh is installed
# (or create the repo in the GitHub UI and `git remote add origin … && git push -u origin main`)
```

Add the live demo URL to the README "Verify it yourself" table once it's up.

## Step 3 — submit (irreversible)

- Submit on **DoraHacks**, **all-in on the single Stellar prize track**, pointing at the live URL + the public repo.
- Record the 2–3 min demo video (yours) and link it.
- Re-run `node scripts/check-links.mjs` so every submitted link is green.

## Env knobs (all optional; safe defaults)

`VITE_VERITAS_ENV` (demo/prod) · `VITE_REAL_PAYMENT` (1/0) · `VITE_DEMO_FUND_SECRET` (testnet seed) ·
`VITE_RPC_URL` / `VITE_RPC_URL_BACKUP` / `VITE_HORIZON_URL`. Details in `web/.env.example`.

## Beyond the hackathon

The product/company roadmap (Phases 16–27 — governance rails, in-circuit counterparty signature, verifiable
encryption, multi-tenant backend, audit + ceremony, regulator side, mainnet) is captured in [PLAN.md](./PLAN.md),
and the go-to-market thesis in [docs/business.md](./docs/business.md). None of it is needed to win; all of it is
real if you pursue Veritas.

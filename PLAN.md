# Veritas — Build Plan

A phased plan from empty repo to a finished, judge-verifiable project. Each phase has a hard
**Definition of Done (DoD)** — we don't move on until it's met.

Status: ⬜ not started · 🔄 in progress · ✅ done

---

## Phase 0 — Foundation & Day-One Gate ✅ DONE
**Goal:** prove the ZK → Soroban path works end-to-end *before* building anything real. The single most
important de-risking step — it kills the "shipped something impressive that never verified on-chain"
failure mode.

- [x] Install toolchain — circom 2.2.3, snarkjs 0.7.6, stellar-cli 27.0.0, rust wasm target
- [x] Build + test the official `soroban-examples` groth16_verifier (BLS12-381) — `cargo test` passes
- [x] Compile a trivial circuit (`a*b=c`) with `--prime bls12381`, trusted setup, generate a proof — verified off-chain (`snarkJS: OK!`)
- [x] Deploy the verifier to Stellar **testnet** and verify the proof **on-chain** — returned `true`

**✅ DoD MET — green on-chain verification on testnet:**
- Verifier contract: `CBOLT6FYCO4JKADIN2W66ZZJ4UDC3IW4SMG2MHYFZOIYF273LOI2PXOO`
- `verify_proof` tx (returned `true`): [`51c26280…c21eb8da`](https://stellar.expert/explorer/testnet/tx/51c26280818a3eca81293c4c281d85740d363aafb0cb183c1d2a6647c21eb8da)
- On-chain pairing-check cost: ~41M / 100M CPU (comfortable headroom).
- The most-at-risk part of the whole project (Circom→Groth16→BLS12-381→Soroban) is proven working.

---

## Phase 1 — Core ZK circuit (the load-bearing proof) ✅ DONE
**Goal:** the real Veritas compliance circuit (`circuits/veritas.circom`).

- [x] Merkle-membership for both VASPs (circuit-derived `registryRoot`, `rootA===rootB`)
- [x] **Threshold / bracket logic over the HIDDEN amount** — the genuinely-ZK core
- [x] IVMS101 data commitment + receiving-VASP acknowledgement binding
- [x] Regulator-view-key attestation commitment (public output)
- [x] Compile `--prime bls12381`, trusted setup, export verification key (8750 non-linear constraints, nPublic=5)
- [x] Poseidon-free fixture generator + reusable snarkjs-JSON→Soroban-bytes encoder (`tools/encode`)
- [x] Incorporate Code Reviewer + Security Engineer findings (range-constrain amount+threshold, enforce leafA≠leafB, bind amount/bracket/both leaves into the commitment, drop the constant `compliant` output)

**✅ DoD MET — the hardened Veritas proof verifies on testnet:**
- `verify_proof` tx (returned `true`): [`11f2f89b…b657ef5b`](https://stellar.expert/explorer/testnet/tx/11f2f89b8ff38a01b538b7a24d66cc691fe846038fd3db34612de232b657ef5b)
- Public signals: `bracket=1, registryRoot, attCommitment, settlementRef, threshold=1000` (nPublic=5).
- 8750 non-linear constraints. Reviewed by Code-Review + Security-Engineer agents.

**Deferred (honestly documented in [SECURITY.md](./SECURITY.md)):** in-circuit B-signature for the
acknowledgement, real verifiable encryption for regulator opening, and `settlementRef`→real-payment
binding. Contract-level findings (public-signal ordering, pin `threshold`, `require_auth`) are fixed in
Phase 2.

---

## Phase 2 — Soroban contract (on-chain compliance anchor) ✅ DONE
**Goal:** the contract that anchors compliance to settlement (`contracts/veritas`).

- [x] Registry root + VK pinned atomically at deploy (`__constructor`, front-run-proof)
- [x] `submit_compliance`: real BLS12-381 Groth16 verify → bind registry + settlement + threshold → store attestation → emit `✓`
- [x] Hardened per Code-Review + Security-Engineer audits (fail-fast ordering, canonicity check, TTL extension, submitter provenance)
- [x] 10 unit tests (all negative branches + real-proof accept/reject) + on-chain integration + replay rejection
- [ ] (deferred, documented in SECURITY.md) in-circuit submitter/VASP identity binding; settlementRef→real-payment binding

**✅ DoD MET — end-to-end on testnet:**
- Veritas contract: `CB6DCNEGNXP7WQB3XVDABZ2TUNM5DSK4VYXLCE4OZWGXMGSZRGYBOFWV`
- `submit_compliance` (real proof): [`20c48e42…`](https://stellar.expert/explorer/testnet/tx/20c48e426a3bf44b7a719226f06db8f919da9b3028fc2f6ce20355554ddedc28)
- `get_attestation` → `{bracket:1, att_commitment, settlement_ref, submitter}` (no PII); replay rejected with `AlreadyAnchored`.

---

## Phase 3 — Off-chain plumbing ✅ DONE
**Goal:** everything around the proof.

- [x] Proving pipeline (circom → snarkjs → bls12381) + Poseidon-free fixture generator (`circuits/gen-veritas-input.mjs`) + reusable snarkjs→Soroban encoder (`tools/encode`)
- [x] IVMS101 record + real on-chain references for the demo (`web/src/lib/fixtures.js`)
- [x] Real proof artifacts pre-generated (proving on-stage avoided per SECURITY.md)

**DoD MET:** the pipeline produces a real proof that verifies on-chain; the browser consumes the
pre-generated proof + the real IVMS101 attestation. (Live in-browser proving deferred for reliability —
**superseded by Phase 7 below**, which moved proving live into the browser on every run.)

---

## Phase 4 — Frontend & the reveal moment ✅ DONE
**Goal:** the demo surface and the unforgettable beat (`web/`).

- [x] Svelte UI: transfer → anchor on Stellar → public sees only `✓` (no PII)
- [x] **The reveal:** "put on the regulator's glasses" (view key) → the full IVMS101 attestation unfolds
- [x] Live on-chain read of `get_attestation` (Soroban RPC) + stellar.expert deep-links
- [x] Hardened per Code-Review + Security-Engineer (render-safe reveal, try/finally + error state, honest live-vs-cached badge, a11y, pinned SDK 12.3.0, no secrets/XSS)
- [x] `npm run build` passes (SvelteKit + Stellar SDK, client-rendered)

**DoD MET:** the public-✓ → regulator-reveal contrast renders; data wired to the real deployed contract.

---

## Phase 5 — Integration, honest README, polish ✅ DONE
- [x] End-to-end on testnet: circuit proof → contract verify+anchor → frontend reads the real attestation
- [x] Submission-ready README with a "Verify it yourself on testnet" table of clickable contract + tx links
- [x] Honest SECURITY.md (real vs mocked, deferred items) reflecting all audit findings
- [x] Frontend polish (render-safe reveal, a11y, error/loading states, reset)

**DoD MET:** a stranger can clone the repo, run it, and independently verify the on-chain artifacts.

---

## Phase 6 — Submission 🔄 superseded by Phases 9–12 below
- [x] Full source committed with a clear README (required)
- [ ] Push to a public GitHub remote (your account) + submit on DoraHacks — **moved to Phase 11**
- [ ] 2–3 min demo video (owned by Arya) — **moved to Phase 12**

**DoD:** submitted on DoraHacks. (Kept here as the historical record; the live checklist for what's left
is Phases 9–12.)

---

## Phase 7 — Live upgrade (in-browser proving + a fresh on-chain tx every run) ✅ DONE
Built to kill the "feels like mock data" critique. Each run now:
- generates the Groth16 proof **in the browser** (snarkjs from `/snarkjs.min.js`) from a user-chosen amount,
- submits it **live** to the deployed contract via the generated TS bindings, signed by an ephemeral
  Friendbot-funded keypair (default) or an **optional Freighter wallet** — a brand-new transaction every run,
- adds a **live tamper demo** (the real contract rejects a forged proof on-chain) and a session **compliance
  log**, with graceful fallback to the cached on-chain proof if that live run fails for any reason —
  network, funding, wallet, or otherwise (A-with-fallback),
- redesigned as **"Two Ledgers"** — a light public ledger (redacted) vs a dark regulator vault that opens with the view key.

De-risked by a JS↔Rust encoder **byte-match** + a **Node end-to-end test** (real fresh tx). Lean per
ponytail (generated bindings over hand-rolled ScVals, CSS over animation libs, one byte-match check).
Needed SDK bump to 16.0.1 (Protocol 23).

**Correction:** this section originally claimed a Security-Engineer pass with "no Critical/High/Medium"
before that pass had actually run. It ran in Phase 8 below and found one Medium (the regulator-reveal
secrets ship in the public demo bundle) — fixed and disclosed there.

---

## Phase 8 — Consensus audit & hardening pass ✅ DONE
**Goal:** a 3-agent panel (Reality-Checker, Security-Engineer, judge-lens) independently re-verified every
claim in this repo against the live testnet artifacts — not the docs — before submission, and every finding
was fixed or honestly disclosed.

- [x] Reality-Checker ran `cargo test`, `npm run build`, `web/live-test.mjs`, and independently
  XDR-decoded all three README-cited transactions plus a brand-new one generated live during the audit —
  confirmed the live in-browser proving claim is genuinely true, not stale or cached.
- [x] Corrected the stale "8 unit tests" claim to 10 across README/PLAN/SECURITY.
- [x] Fixed 3 Svelte a11y warnings (unassociated `<label>`s) in `+page.svelte`.
- [x] Fixed `scripts/check-encode.mjs` — it hardcoded a dead session-specific path and could no longer
  actually run; rewritten to be self-contained (builds+runs `tools/encode` into a fresh temp dir) and
  re-run to reconfirm the JS↔Rust byte-match still holds.
- [x] Security-Engineer found one **Medium** (new, not previously disclosed): the regulator view-key
  reveal ships its secrets and the full synthetic IVMS101 payload in the public client bundle regardless
  of whether "reveal" is clicked — it's a UI-state simulation, not real access control. Copy in
  `+page.svelte` and the "real vs. simulated" table in `docs/architecture.md` corrected to say so; disclosed
  in SECURITY.md.
- [x] Disclosed in SECURITY.md that the Groth16 trusted setup was a single local contribution (no
  multi-party ceremony) — a soundness caveat that was missing from the threat model.
- [x] Assessed `npm audit`'s 13 flagged vulnerabilities: all are in build-time tooling (Vite/SvelteKit dev
  server) or Node-CLI-only transitive deps of `snarkjs` (the browser loads a prebuilt `/snarkjs.min.js`
  static file, never the npm package's internals) — none reach the shipped bundle. Not force-fixed to avoid
  breaking the build for zero real exposure reduction.

**DoD MET:** every audit finding is either fixed or honestly disclosed; `cargo test` (10/10) and
`npm run build` both still pass clean after the fixes.

---

## Phase 9 — Judge-experience polish (repo-side) ⬜ not started
**Goal:** the README reads the way a 60-second sponsor-judge skim needs it to, per the judge-lens audit.

- [ ] Front-load the Binance $4.3B figure as its own bolded lede line, not buried in paragraph 1
- [ ] Add a screenshot or short GIF of the "Two Ledgers" reveal right after the on-chain verify-table —
  currently the single best asset in the repo is invisible until a judge runs it themselves
- [ ] Compress the inline "what's real vs. simulated" block in the README to ~2 lines, pointing to
  SECURITY.md for the full breakdown, so the hot zone right after the verify-table stays focused on payoff

**DoD:** a top-to-bottom skim hits pain → tech → payoff, with visual proof of the product before any
plumbing tables.

---

## Phase 10 — Live hosted demo ⬜ not started (needs a go/no-go: creates a public URL)
**Goal:** a judge can see the reveal moment without cloning the repo or installing a toolchain.

- [ ] Deploy `web/` to Vercel/Netlify/Cloudflare Pages (adapter-auto already configured)
- [ ] Link the live URL at the very top of README.md
- [ ] Click through once on a clean browser profile with no wallet extension to confirm the zero-setup
  ephemeral/Friendbot path works for a cold visitor — the exact path every judge hits first

**DoD:** a live URL exists, is linked from the README, and the default path works with zero setup.

---

## Phase 11 — Public repo + DoraHacks submission ⬜ not started (needs a go/no-go: public + irreversible)
- [ ] Push to a public GitHub remote (currently no remote is configured at all)
- [ ] Confirm the repo renders in an incognito window (no auth wall)
- [ ] Submit on DoraHacks
- [ ] Flip PLAN.md's Phase 6 checkboxes once done — this phase supersedes Phase 6 above

**DoD:** submitted on DoraHacks with a working public GitHub link.

---

## Phase 12 — Demo video ⬜ not started (owned by Arya)
- [ ] Record and link the 2–3 min demo video referenced in Phase 6/DoraHacks submission

**DoD:** video recorded and linked.

---

### The three win-conditions to hold throughout
1. **Keep the ZK load-bearing** — center it on the hidden-amount/bracket logic + verifiable
   computation over private IVMS data, so it's never "ZK wrapping signatures."
2. **Ship it complete** — a 70%-done compliance protocol is invisible to judges.
3. **The reveal moment is the demo** — public `✓` → regulator view-key → full attestation. Build it as
   a real on-screen beat, not a footnote.

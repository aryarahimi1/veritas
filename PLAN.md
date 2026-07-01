# Veritas — Build Plan

A phased plan from empty repo to a finished, independently verifiable project. Each phase has a hard
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
- [x] Incorporate code-review + security findings (range-constrain amount+threshold, enforce leafA≠leafB, bind amount/bracket/both leaves into the commitment, drop the constant `compliant` output)

**✅ DoD MET — the hardened Veritas proof verifies on testnet:**
- `verify_proof` tx (returned `true`): [`11f2f89b…b657ef5b`](https://stellar.expert/explorer/testnet/tx/11f2f89b8ff38a01b538b7a24d66cc691fe846038fd3db34612de232b657ef5b)
- Public signals: `bracket=1, registryRoot, attCommitment, settlementRef, threshold=1000` (nPublic=5).
- 8750 non-linear constraints. Hardened by independent code-review and security passes.

**Deferred (honestly documented in [SECURITY.md](./SECURITY.md)):** in-circuit B-signature for the
acknowledgement, real verifiable encryption for regulator opening, and `settlementRef`→real-payment
binding. Contract-level findings (public-signal ordering, pin `threshold`, `require_auth`) are fixed in
Phase 2.

---

## Phase 2 — Soroban contract (on-chain compliance anchor) ✅ DONE
**Goal:** the contract that anchors compliance to settlement (`contracts/veritas`).

- [x] Registry root + VK pinned atomically at deploy (`__constructor`, front-run-proof)
- [x] `submit_compliance`: real BLS12-381 Groth16 verify → bind registry + settlement + threshold → store attestation → emit `✓`
- [x] Hardened per independent code-review + security audits (fail-fast ordering, canonicity check, TTL extension, submitter provenance)
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
- [x] Hardened per code-review + security passes (render-safe reveal, try/finally + error state, honest live-vs-cached badge, a11y, pinned SDK 12.3.0, no secrets/XSS)
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

## Phase 6 — Submission 🔄 superseded by Phase 15 below
- [x] Full source committed with a clear README (required)
- [ ] Publish the repo + submit on DoraHacks — **moved to Phase 15**

**DoD:** submitted on DoraHacks. (Kept here as the historical record; the live checklist is Phase 15.)

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

De-risked by a JS↔Rust encoder **byte-match** + a **Node end-to-end test** (real fresh tx). Kept deliberately
lean (generated bindings over hand-rolled ScVals, CSS over animation libs, one byte-match check).
Needed SDK bump to 16.0.1 (Protocol 23).

**Correction:** this section originally claimed a security pass with "no Critical/High/Medium"
before that pass had actually run. It ran in Phase 8 below and found one Medium (the regulator-reveal
secrets ship in the public demo bundle) — fixed and disclosed there.

---

## Phase 8 — Consensus audit & hardening pass ✅ DONE
**Goal:** a three-lens consensus audit (reality-check, security, and fresh-reader passes) independently
re-verified every claim in this repo against the live testnet artifacts — not the docs — and every finding
was fixed or honestly disclosed.

- [x] The reality-check pass ran `cargo test`, `npm run build`, `web/live-test.mjs`, and independently
  XDR-decoded all three README-cited transactions plus a brand-new one generated live during the audit —
  confirmed the live in-browser proving claim is genuinely true, not stale or cached.
- [x] Corrected the stale "8 unit tests" claim to 10 across README/PLAN/SECURITY.
- [x] Fixed 3 Svelte a11y warnings (unassociated `<label>`s) in `+page.svelte`.
- [x] Fixed `scripts/check-encode.mjs` — it hardcoded a dead session-specific path and could no longer
  actually run; rewritten to be self-contained (builds+runs `tools/encode` into a fresh temp dir) and
  re-run to reconfirm the JS↔Rust byte-match still holds.
- [x] The security pass found one **Medium** (new, not previously disclosed): the regulator view-key
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

## Finish-line plan (Phases 9–27) — two tracks

After the Phase-8 audit, the remaining work was reconciled into two **honestly-labeled** tracks. **DEMO** =
the public demo and its verifiable surfaces. **PRODUCT** = the production build beyond the demo. **BOTH** =
demo-visible slivers on top of production value. This plan supersedes the earlier thinner Phases 9–12, which it
absorbs and expands. *(Working-branch commits are tagged "Phase 8–13" from an earlier numbering; they map 1:1 to
Phases 9–14 here.)*

### Demo track — Phases 9–15

## Phase 9 — Kill the cached-fallback contradiction ✅ DONE · DEMO (`a68e2b5`)
**Goal:** make it structurally impossible for the demo to render a bracket/amount that contradicts another panel.
- On a failed live run, stop silently swapping in the cached proof under the user's slider value; show an explicit
  **Retry live** card that *preserves the chosen amount*, with the cached proof behind an opt-in button.
- `showCached()` snaps every panel AND the slider to the cached tx's own values under a loud banner; the slider
  locks once anchored so a post-run drag can't re-create the contradiction.
- Tamper button + SIMULATED badges stay visible via `DEMO_MODE` (`VITE_VERITAS_ENV`); the 7 contract error codes
  are surfaced by name (`web/src/lib/errors.js`).

**DoD MET:** build green; cached fixture verified self-consistent (recomputed commitment === anchored value); an
adversarial review pass found + fixed one slider-lock gap.

## Phase 10 — Live-proving reliability ✅ DONE · DEMO (`0841369`)
**Goal:** maximize the odds the room sees a real live run, not the fallback.
- `prewarm()` warms snarkjs + wasm + zkey and pre-funds an account on mount; `submitWithRetry` retries once
  (optionally against `VITE_RPC_URL_BACKUP`) on transient RPC hiccups but never on a deterministic contract error;
  an optional stable faucet signer (`VITE_DEMO_FUND_SECRET`) keeps the run LIVE if Friendbot fails; a `preflight()`
  status dot shows reachability.

**DoD MET:** build green; happy path unchanged, failure paths additive. *(Live network paths must be exercised on
a networked machine — CI/build sandboxes can't reach Friendbot/RPC.)*

## Phase 11 — Bind the proof to a real Stellar payment ✅ DONE · BOTH (`70c9a27`)
**Goal:** make Stellar the on-screen protagonist twice — a real payment AND its compliance proof, one settlement id.
- Before proving, send a REAL testnet settlement payment (A → fresh B via `createAccount`) and derive
  `settlementRef` from its tx hash; render both txs (payment ↦ compliance) as stellar.expert deep-links.
- Feature-flagged (`VITE_REAL_PAYMENT`), graceful fallback to a nonce ref; no circuit/contract change.

**DoD MET:** build green (Horizon bundles); ref derivation verified consistent (`FIELD === witness P`, canonical,
equals `pub_signals[3]`); `live-test.mjs` extended to assert the linkage. *(Payment path to be verified live.)*

## Phase 12 — Positioning ($4.3B, why Stellar) ✅ DONE · DEMO (`fa708cf`)  *(absorbs the earlier demo-experience phase)*
**Goal:** the first screen states the pain number, what Veritas is, and why *Stellar specifically*.
- README reframed to "why ZK, why on-chain, and why Stellar" — Soroban's native BLS12-381 host functions
  (~41M/100M CPU) are the load-bearing reason; the real-payment story folded in; app hero + footer sharpened.

**DoD MET:** README leads with `$4.3B`; the one-liner + why-Stellar appear on README, app hero, and footer.
*(Still open: a screenshot/GIF of the "Two Ledgers" reveal in the README.)*

## Phase 13 — Static SPA build for deployment ✅ DONE · DEMO (`625ce3c`)  *(absorbs the earlier "live hosted demo")*
**Goal:** a static SPA anyone can open on an HTTPS URL where in-browser proving works.
- `adapter-auto` → `adapter-static` (SPA); intentionally **no** COOP/COEP (would break cross-origin
  Friendbot/RPC/Horizon fetches); `web/vercel.json` (static output, immutable asset cache, SPA rewrite);
  `.env.example` refreshed to the real `VITE_` knobs.

**DoD MET (engineering):** static build emits `index.html` + `_app` + all proving assets. **Deploy is an
owner step** (Vercel account); then add the live URL to the README + the submission.

## Phase 14 — Fresh-tx indexing gate + link/surface sweep ✅ DONE · DEMO (`7ab1b0d`)
**Goal:** every clickable surface resolves; a fresh-tx link never 404s.
- Gate fresh-tx explorer links behind a ~6s indexing grace ("hash · indexing…"), then link; cached txs link
  immediately. `scripts/check-links.mjs` curls every doc + on-chain link.

**DoD MET:** build green; link checker ran **6/6 links 200**.

## Phase 15 — Public repo + DoraHacks submission 🔄 · DEMO  *(absorbs the earlier submission phase)*
**Goal:** the one-time publication — outward-facing and irreversible, so it runs last.
- Make the repo public; deploy `web/` to Vercel; add the live URL to the README "Verify it yourself" table;
  complete the DoraHacks entry.

**DoD:** repo public; submission live with the deployed URL; every link resolves.

### Product track — Phases 16–27 (the real-company build beyond the demo)

Each serves the *product*. Every circuit/contract-touching phase is done on an isolated
branch/worktree with the full live path re-verified before merge; **main always stays demo-shippable**.

## Phase 16 — Wedge & partner-with GTM ⬜ PRODUCT
ICP = Stellar-native stablecoin VASPs/anchors; position as the on-chain proof layer that **partners with**
Notabene/Sygna/TRP (which move the PII) rather than competing. **DoD:** one-page ICP + wedge doc; partner-with
thesis validated by a real conversation; one design partner committed to a sandboxed pilot. *(See docs/business.md.)*

## Phase 17 — On-chain governance & versioning rails ⬜ PRODUCT
Updatable registry root + VK upgrade hook via **threshold multisig + timelock**, with a hard invariant that
governance can never alter/forge a *stored* attestation. Kept OFF the demo build (the demo keeps its immutable
"no backdoor" narrative). **DoD:** on an isolated contract, a full governance cycle demonstrated (rotate root,
adopt new VK, old proofs rejected, stored attestations byte-identical, unauthorized calls revert).

## Phase 18 — Real counterparty + originator ⬜ BOTH
In-circuit EdDSA-Poseidon signature by VASP B over `(settlementRef, ivmsHash)`; bind the submitter as a public
signal + prove knowledge of the VASP-A leaf secret (closes SECURITY.md HIGH-2). **Demo-sliver (contingent):** a
second live on-chain rejection ("wrong identity → rejected"). **DoD:** circuit rejects a missing B-signature /
wrong submitter; fresh instance verifies on testnet; in-browser prove time still acceptable.

## Phase 19 — Secret-commitment registry leaves ⬜ PRODUCT
Replace guessable LEI-hash leaves with hiding commitments `Poseidon(vaspPubkey, blinding)` + proof-of-knowledge,
so an observer can't tell which VASP a leaf is. **DoD:** membership proven under hiding leaves; governed root
rotation exercised; full live path verified on a fresh/upgraded instance.

## Phase 20 — Verifiable encryption of the regulator record ⬜ BOTH
Replace commitment-reconstruction with real in-circuit encryption to a **pinned regulator pubkey**, so the
regulator genuinely DECRYPTS with a private view key. **Demo-sliver (contingent):** the hero reveal becomes a real
decryption. **HARD GATE:** if it slows in-browser proving below the demo budget, it stays a server-proving PRODUCT
path and does NOT merge to the demo build. **DoD:** regulator decrypts an on-chain ciphertext; encryption proven
correct in-circuit; live proving still fast enough (or explicitly parked).

## Phase 21 — Bind settlementRef in-circuit ⬜ PRODUCT
Constrain `settlementRef == H(payment from, to, amount, asset)` in-circuit so the regulator can prove the opened
amount equals the real payment value (soundness backfill for Phase 11's UI linkage). **DoD:** circuit rejects a
`settlementRef` that isn't the payment field-hash; regulator can show opened amount == on-chain payment value.

## Phase 22 — Multi-tenant control plane + product UI ⬜ PRODUCT
API keys/quotas; a DB that is a **read-model of chain** (no PII persisted); org/role model; dashboard, transfer
list w/ per-record detail, VASP registry screen, exportable audit log; the 7 error codes as a first-class taxonomy.
Gated behind `VITE_VERITAS_ENV=prod`; the demo `/` route untouched. **DoD:** a new org self-serves a sandbox key,
drives a submission through its status machine, exports a signed audit log — read-model proven to match chain.

## Phase 23 — Async proving service + submission relayer ⬜ PRODUCT
Client-side proving stays the DEFAULT (zero PII at Veritas); opt-in server-side proving in an isolated,
in-memory-only worker (no PII logs, zeroized). Relayer with `settlementRef` idempotency, retries, signed webhooks.
**DoD:** load test with zero double-anchors under retry storms; a scrub test proves server-side proving leaves no
PII on disk or in logs.

## Phase 24 — Independent audit + real trusted-setup ceremony ⬜ PRODUCT (gate before real PII/funds)
Separate ZK-circuit and Soroban-contract audits; a real multi-party ceremony with a public transcript (or a
setup-free proof system); adopt the audited VK via the Phase-17 upgrade path; publish a trust-center page.
**DoD:** both audit reports clean; ceremony transcript independently verifiable; production VK live, full path
green. *(This is the earlier roadmap's "blocker gate" — correctly placed here, after submission, not before.)*

## Phase 25 — Make the regulator side real ⬜ PRODUCT
Prefer "Veritas never custodies PII": verifiable encryption to the regulator pubkey (Phase 20) with the private
key in an HSM; isolated regulator auth/trust domain; case/legal-basis reference + immutable "who opened what" log.
**DoD:** a regulator opens a record only via their HSM key; operators provably cannot decrypt; every open logged.

## Phase 26 — Mainnet readiness & operations ⬜ PRODUCT
Fee/sponsorship so VASPs hold no XLM; incident-response runbook for the immutable contract; monitoring; CI security
gates (SAST/deps/secrets + a VK-drift gate); legal sign-off; WCAG AA pass; a bounded mainnet pilot. **DoD:** a
mainnet transfer anchored with sponsored fees; runbook dry-run tested; legal sign-off on file. *(Do NOT chase
mainnet before submission — it risks the stable testnet demo.)*

## Phase 27 — Package & scale ⬜ PRODUCT
Live pricing + self-serve onboarding, docs + sandbox to public quality, a design-partner case study, more
settlement rails/registries via the versioned registry model. **DoD:** a new VASP signs up and goes live
self-serve under published pricing; a case study with real pilot numbers.

---

### Three principles held throughout
1. **Keep the ZK load-bearing** — center it on the hidden-amount/bracket logic + verifiable
   computation over private IVMS data, so it's never "ZK wrapping signatures."
2. **Ship it complete** — a 70%-done compliance protocol isn't credible.
3. **The reveal moment is the demo** — public `✓` → regulator view-key → full attestation. Build it as
   a real on-screen beat, not a footnote.

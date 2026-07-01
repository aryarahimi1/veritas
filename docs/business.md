# Veritas — the business (infrastructure, not a dApp)

A short, honest read on what Veritas is as a company, who buys it, and how it's sold. This is post-hackathon
thinking; none of it is needed for the demo, and none of it should touch the demo build.

## What it is

Not "just an SDK," and not a consumer dApp — it's an **on-chain protocol with an SDK as the doorway**, three parts:

1. **SDK** — runs *inside each exchange's* systems and generates the ZK proof locally, so **PII never leaves the
   customer** (exactly as the demo already proves in-browser — client-side proving is the production architecture,
   not a demo shortcut).
2. **Shared Soroban contract on Stellar** — the neutral verification + anchoring layer nobody owns.
3. **Registry** — the licensed-VASP set everyone trusts.

The SDK is forkable; the neutral shared verification layer + registry is the moat, and the reason this is on a
blockchain at all. An SDK alone wouldn't need Stellar.

## Why "infra, not a dApp" is the logical shape

For a *regulated* product the customer is definitionally a business — there is no consumer version of "exchanges
proving Travel-Rule compliance to each other." B2B infra isn't a compromise here; it's the only coherent model.
And it's the most proven, fundable category in crypto. Precedent, tiered:

- **Exact category (Travel-Rule / compliance infra, SDKs exchanges integrate, no consumer app):** Notabene, Sygna,
  TRP, VerifyVASP, Sumsub, 21 Analytics; Chainalysis / TRM / Elliptic. Their existence is *validation* — the buyers
  exist and pay.
- **Web3 dev infra (pure SDK/API):** Alchemy, Infura, Fireblocks, Circle, Privy, Thirdweb.
- **ZK / attestation infra (closest cousins):** Ethereum Attestation Service, Sismo, Polygon ID, Reclaim; RISC Zero,
  Succinct. And the cleanest analogy: **Stripe** is fundamentally an SDK/API — nobody calls it "just an SDK."

## The wedge and the go-to-market

- **ICP:** Stellar-native stablecoin issuers / anchors and the VASPs settling their transfers — companies already on
  Stellar rails, already legally required to do the Travel Rule, already exposed to the $4.3B-class tail risk.
- **Buyer:** the compliance / BSA officer. **Trigger:** regulator pressure, audit exposure.
- **Partner *with*, don't compete with, the existing networks.** Notabene/Sygna/TRP already move the IVMS101 data
  and already have the VASP network. What they *lack* is the shared, on-chain, forgery-proof **proof** of
  compliance. Veritas rides on top as that proof layer — which sidesteps the cold-start "get the whole industry on
  my network first" problem. Validate this thesis with a real conversation before over-investing; if they read
  Veritas as competitive, revisit.

## How it's used, concretely

The exchange runs the SDK server-side; its systems generate the proof over their own data (PII never leaves them);
its **Stellar service account** signs and submits the proof to the shared contract, which verifies and anchors a
PII-free receipt. A regulator with the view key opens the full record. The demo acts out all these roles on one
screen because you can't onboard a real exchange for a hackathon — but the mechanism is identical.

## Monetization

- **Per-proof fee** on each compliance anchor (volume play — millions of Travel-Rule transfers).
- Optional per-org subscription / tiers on top.
- **Regulators get read access free** — not charity, but distribution: regulatory pull toward verifiable Veritas
  receipts is worth more than a sales team.

## The honest caveat

Infra GTM is slower and B2B — you sell to compliance officers, not a viral consumer wave. That's a property of the
category, not a flaw in the idea, and it doesn't touch the hackathon at all: the demo is a self-contained visual
showroom of the whole thing.

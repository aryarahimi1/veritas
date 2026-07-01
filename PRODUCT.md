# Product

## Register

brand

## Users

**Primary — the people who'd deploy this.** VASP compliance / BSA officers and the regulators who audit
them. Sober, risk-averse, skeptical by profession; they've watched peers pay nine-figure fines. They do
not trust marketing; they trust things they can verify. When they look at Veritas they are asking one
question: "is this real, and can I prove it did what it says?"

**Secondary — the people who skim it in 60 seconds.** Stellar-ecosystem builders and hackathon judges.
They need two things fast: the unforgettable moment (proof that this actually works on-chain), and the
signal that this is genuine *infrastructure others build on*, not a toy app. An integrator must see the
few lines of code they'd write; a judge must feel the mechanism before they read a word.

## Product Purpose

Veritas is a privacy-preserving Travel Rule (FATF R16) compliance protocol on Stellar: a shared,
on-chain, forgery-proof *proof-of-compliance* that exchanges generate client-side (PII never leaves them)
and anchor inside a Soroban smart contract. The public sees a verified check; a regulator with the view
key opens the full record. This page is the protocol's showcase. Success = a skimming judge trusts it's
real and remembers the reveal, and an integrator recognizes it as infrastructure they could wire into
their own systems.

## Brand Personality

Institutional. Cryptographic. Authoritative. The voice is precise, sober, and quietly confident, the tone
of a compliance system a central bank would actually run, not a crypto startup shouting. Emotional goal:
*earned trust*, plus one jolt of "wait, that's genuinely real, on-chain, right now." Gravitas over hype.
It should feel closer to a settlement-system or a regulatory filing than to a consumer app, but alive and
legible, not a dead PDF.

## Anti-references

- **Generic crypto (the hard no).** Neon or glow on pure black, hype gradients, coin logos, "web3"
  clichés, animated blockchain nodes. Veritas earns trust from regulators; that aesthetic destroys it.
- **SaaS-purple template.** Purple gradients, the big-number hero-metric block, endless identical
  icon + heading + text card grids, rounded-everything. Reads as a template, not infrastructure.
- Marketing fluff over proof. No claim appears without something a stranger can click and verify.

## Design Principles

1. **Verifiable, never asserted.** Every claim resolves to something checkable on-chain (contract, tx,
   explorer). Trust is earned by proof, not by copy. The verify-yourself surface is a first-class section,
   not a footnote.
2. **Quiet authority.** The gravitas of infrastructure a regulator and a bank both rely on. Restraint,
   precision, and confidence shown rather than shouted. When in doubt, remove, don't add.
3. **Proof is the visual language.** The interface makes the cryptography legible, redaction, sealing,
   opening with a key, on-chain rejection, so a viewer *feels* the mechanism instead of reading an
   explanation of it. The two-ledgers contrast (public redacted document vs. sealed regulator vault) is
   the core metaphor.
4. **One unforgettable moment.** The public-check to regulator-reveal, and the live on-chain forgery
   rejection, are the emotional core. Everything else on the page exists to set them up and land them.
5. **Honest by construction.** What is real vs. simulated is stated in the open; the honesty is a
   credibility asset, not a disclaimer to hide.
6. **A protocol, not an app.** Lead with what it is and how you build on it (the SDK integration is a
   deliberate, prominent section). One page, structured like protocol infrastructure, never a dashboard.

## Accessibility & Inclusion

WCAG AA contrast minimum on all text and the ink/parchment surfaces. Respect `prefers-reduced-motion`:
the cinematic vault-reveal and the forgery-rejection must have a calm, instant fallback that loses none
of the meaning. Never rely on color alone, the verified/rejected, redacted, and sealed/open states each
carry a non-color cue (icon, label, or shape) as well as color.

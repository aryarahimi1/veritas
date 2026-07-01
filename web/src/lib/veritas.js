// Live engine: in-browser ZK proof -> fresh on-chain submission. Verified end-to-end (see live-test.mjs).
// snarkjs runs from the prebuilt /snarkjs.min.js (avoids bundling ffjavascript's node builtins).
import { Client, networks, Keypair, contract } from '$lib/veritas-client/dist/index.js';
import { buildInput, randomSettlementRef } from './witness.js';
import { recomputeAttCommitment } from './attestation.js';
import { encodeProof } from './proof.js';
import { IVMS101_ATTESTATION } from './fixtures.js';
import { parseContractError } from './errors.js';
import { Horizon, TransactionBuilder, Operation, Memo, BASE_FEE } from '@stellar/stellar-sdk';

const { basicNodeSigner } = contract;
const RPC = import.meta.env?.VITE_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const RPC_BACKUP = import.meta.env?.VITE_RPC_URL_BACKUP ?? '';
const FUND_SECRET = import.meta.env?.VITE_DEMO_FUND_SECRET ?? ''; // optional pre-funded testnet account
const HORIZON = import.meta.env?.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
const REAL_PAYMENT = (import.meta.env?.VITE_REAL_PAYMENT ?? '1') !== '0'; // bind the proof to a real payment
const FIELD = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n; // BLS12-381 scalar field r
const { networkPassphrase, contractId } = networks.testnet;
const WASM = '/circuit/veritas.wasm';
const ZKEY = '/circuit/veritas_final.zkey';

let _snarkjs;
let _account; // funded once and reused
let _wallet = 'ephemeral'; // 'ephemeral' | 'freighter'
let _walletGen = 0; // bumped on every explicit wallet change, to defeat a prewarm funding race
export const setWallet = (kind) => { _wallet = kind; _account = null; _walletGen++; };
export const getWallet = () => _wallet;

async function loadSnarkjs() {
  if (_snarkjs) return _snarkjs;
  if (!window.snarkjs) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/snarkjs.min.js';
      s.onload = res;
      s.onerror = () => rej(new Error('failed to load snarkjs'));
      document.head.appendChild(s);
    });
  }
  return (_snarkjs = window.snarkjs);
}

async function ephemeral() {
  const kp = Keypair.random();
  const res = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`); // create + fund on testnet
  if (!res.ok) throw new Error(`friendbot funding failed (${res.status})`);
  const { signTransaction } = basicNodeSigner(kp, networkPassphrase);
  return { publicKey: kp.publicKey(), signTransaction, kind: 'ephemeral' };
}

// Optional Freighter path — needs the extension (testnet + funded). freighter-api resolves
// with {error} rather than throwing, so check explicitly and throw -> ensureAccount falls back to ephemeral.
async function freighter() {
  const f = await import('@stellar/freighter-api');
  const access = await f.requestAccess();
  if (access?.error) throw new Error(access.error);
  const net = await f.getNetworkDetails();
  if (net?.networkPassphrase !== networkPassphrase) throw new Error('switch Freighter to Testnet');
  const { address, error } = await f.getAddress();
  if (error || !address) throw new Error(error || 'no Freighter address');
  const signTransaction = async (xdr) => {
    const r = await f.signTransaction(xdr, { networkPassphrase, address });
    if (r?.error) throw new Error(r.error);
    return { signedTxXdr: r.signedTxXdr ?? r, signerAddress: address };
  };
  return { publicKey: address, signTransaction, kind: 'freighter' };
}

// Optional pre-funded testnet demo account (VITE_DEMO_FUND_SECRET). Used only when Friendbot funding
// fails, so a rate-limited faucet never forces the cached fallback — the run stays a real, live tx.
async function faucetAccount() {
  const kp = Keypair.fromSecret(FUND_SECRET);
  const { signTransaction } = basicNodeSigner(kp, networkPassphrase);
  return { publicKey: kp.publicKey(), signTransaction, kind: 'faucet' };
}

async function ensureAccount() {
  if (_account) return _account;
  const gen = _walletGen; // capture the selection so a click during funding isn't clobbered (prewarm race)
  let acct;
  if (_wallet === 'freighter') {
    try {
      acct = await freighter();
    } catch {
      _wallet = 'ephemeral'; // extension missing/denied/wrong-network -> graceful fallback
    }
  }
  if (!acct) {
    try {
      acct = await ephemeral();
    } catch (e) {
      if (!FUND_SECRET) throw e;
      acct = await faucetAccount(); // keep the run LIVE despite Friendbot
    }
  }
  if (gen === _walletGen) _account = acct; // only cache if the wallet selection didn't change meanwhile
  return acct;
}

const newClient = (acct, rpcUrl = RPC) =>
  new Client({ contractId, rpcUrl, networkPassphrase, publicKey: acct.publicKey, signTransaction: acct.signTransaction });

// Submit with a single retry (optionally against a backup RPC) for transient RPC hiccups. A
// deterministic contract rejection is never retried — it is surfaced immediately.
async function submitWithRetry(acct, enc, publicSignals, settlementRef) {
  const urls = RPC_BACKUP ? [RPC, RPC_BACKUP] : [RPC, RPC];
  let lastErr;
  for (const rpcUrl of urls) {
    let tx;
    try {
      // build + simulate — safe to retry (nothing has been broadcast yet)
      tx = await newClient(acct, rpcUrl).submit_compliance({
        submitter: acct.publicKey,
        proof: { a: enc.a, b: enc.b, c: enc.c },
        pub_signals: publicSignals.map((s) => BigInt(s)),
        settlement_ref: settlementRef
      });
    } catch (e) {
      lastErr = e;
      if (parseContractError(String(e?.message || e))) throw e; // deterministic contract error — surface now
      continue; // transient simulate/RPC failure — retry on the next url
    }
    // past this point the tx will be broadcast; do NOT retry a send failure (avoids a false #7 on a tx
    // that actually anchored). A retry-worthy hiccup here surfaces as a failed run -> the user clicks Retry.
    return await tx.signAndSend();
  }
  throw lastErr;
}

// Warm the heavy proving assets (snarkjs, wasm, zkey) and pre-fund an account on page load, so the
// first click is instant and the only mid-demo network surface is the final submit. Never throws.
export async function prewarm() {
  await Promise.allSettled([
    loadSnarkjs().catch(() => {}),
    fetch(WASM, { cache: 'force-cache' }).catch(() => {}),
    fetch(ZKEY, { cache: 'force-cache' }).catch(() => {}),
    fetch('/snarkjs.min.js', { cache: 'force-cache' }).catch(() => {}),
    ensureAccount().catch(() => {})
  ]);
}

// Pre-flight reachability: HEAD the three proving assets + ping the RPC, so the UI can show whether a
// live run is safe right now. Returns { assets, rpc, ok, status: 'ready'|'degraded'|'down' }.
export async function preflight() {
  const ok = async (fn) => { try { return await fn(); } catch { return false; } };
  const head = (u) => ok(async () => (await fetch(u, { method: 'HEAD' })).ok);
  const [wasm, zkey, sj, rpc] = await Promise.all([
    head(WASM),
    head(ZKEY),
    head('/snarkjs.min.js'),
    ok(async () => {
      const r = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' })
      });
      return r.ok;
    })
  ]);
  const assets = wasm && zkey && sj;
  return { assets, rpc, ok: assets && rpc, status: assets && rpc ? 'ready' : assets || rpc ? 'degraded' : 'down' };
}

// Deterministically map a Stellar tx hash (hex) to a canonical settlementRef (< r), so the settlement
// payment and the compliance proof are bound by one shared on-chain settlement id.
function refFromHash(hexHash) {
  return BigInt('0x' + hexHash) % FIELD;
}

// Phase 10: send a REAL testnet settlement payment (VASP A -> a fresh beneficiary B) and return its
// hash. createAccount is the canonical "send value to a brand-new account" op, so it always succeeds
// against a fresh B as long as the source is funded — no pre-existing beneficiary required.
async function sendSettlementPayment(acct) {
  const horizon = new Horizon.Server(HORIZON);
  const source = await horizon.loadAccount(acct.publicKey);
  const beneficiary = Keypair.random();
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.createAccount({ destination: beneficiary.publicKey(), startingBalance: '1.5' }))
    .addMemo(Memo.text('Veritas settlement'))
    .setTimeout(60)
    .build();
  const { signedTxXdr } = await acct.signTransaction(tx.toXDR());
  const res = await horizon.submitTransaction(TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase));
  return { hash: res.hash, beneficiary: beneficiary.publicKey() };
}

/** The headline path: prove `amount` in-browser, submit a BRAND-NEW tx. Throws on failure (caller falls back). */
export async function anchorLive(amount, onStep = () => {}) {
  onStep('loading');
  const snarkjs = await loadSnarkjs();
  const acct = await ensureAccount();

  // Phase 10: bind the compliance proof to a REAL Stellar payment. Best-effort and feature-flagged —
  // if the payment step fails for ANY reason, fall back to a fresh nonce so the demo never hard-fails.
  onStep('paying');
  let settlementRef = null;
  let paymentTx = null;
  if (REAL_PAYMENT) {
    try {
      // cap the payment on the critical path: if Horizon is slow, degrade to a nonce ref fast rather than
      // stalling the headline (the SDK's own submit timeout is 60s — too long for a live demo).
      const pay = await Promise.race([
        sendSettlementPayment(acct),
        new Promise((_, rej) => setTimeout(() => rej(new Error('settlement payment timed out')), 12000))
      ]);
      paymentTx = pay.hash;
      settlementRef = refFromHash(pay.hash);
    } catch (e) {
      console.warn('settlement payment unavailable; using nonce settlementRef:', e?.message || e);
    }
  }
  if (settlementRef == null) settlementRef = randomSettlementRef();

  onStep('proving');
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(buildInput(amount, settlementRef), WASM, ZKEY);
  onStep('submitting');
  const enc = encodeProof(proof);
  const sent = await submitWithRetry(acct, enc, publicSignals, settlementRef);
  return {
    live: true,
    txHash: sent.sendTransactionResponse?.hash,
    paymentTx, // Phase 10: the settlement payment this proof is bound to (null if unavailable)
    account: acct.publicKey,
    kind: acct.kind, // reflects a silent ephemeral fallback
    bracket: Number(publicSignals[0]),
    attCommitment: publicSignals[2],
    settlementRef: publicSignals[3],
    amount
  };
}

/** Live negative demo: tamper the committed attestation -> the deployed contract rejects (ProofInvalid).
 *  Distinguishes a real on-chain rejection from a local/network failure so the UI can't over-claim. */
export async function tamperReject(amount) {
  const snarkjs = await loadSnarkjs();
  const acct = await ensureAccount();
  const settlementRef = randomSettlementRef();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(buildInput(amount, settlementRef), WASM, ZKEY);
  const enc = encodeProof(proof);
  const bad = publicSignals.map((s) => BigInt(s));
  bad[2] = bad[2] + 1n; // corrupt attCommitment (still canonical) -> pairing fails on-chain
  try {
    const tx = await newClient(acct).submit_compliance({
      submitter: acct.publicKey,
      proof: { a: enc.a, b: enc.b, c: enc.c },
      pub_signals: bad,
      settlement_ref: settlementRef
    });
    await tx.signAndSend();
    return { rejected: false }; // should not happen
  } catch (e) {
    const m = String(e?.message || e);
    const ce = parseContractError(m);
    const onChain = !!ce || /Error\(Contract/i.test(m);
    return onChain
      ? { rejected: true, code: ce?.code ?? 3, reason: ce ? `#${ce.code} ${ce.name}` : 'rejected on-chain' }
      : { rejected: false, localError: m.split('\n')[0] };
  }
}

/** Live read of the public receipt — simulate-only, no account/signing needed. */
export async function readAttestation(settlementRef) {
  const tx = await new Client({ contractId, rpcUrl: RPC, networkPassphrase }).get_attestation({
    settlement_ref: BigInt(settlementRef)
  });
  const a = tx.result;
  if (!a) return null;
  return {
    bracket: Number(a.bracket),
    attCommitment: a.att_commitment?.toString(),
    settlementRef: a.settlement_ref?.toString(),
    submitter: a.submitter,
    ledger: a.ledger
  };
}

/** Regulator opens the attestation with the view key. (Commitment-open demo; see SECURITY.md.)
 * `run` is the just-anchored result ({ amount, settlementRef, bracket, attCommitment }). The revealed
 * transfer.amount is overridden with THIS run's actual amount — every other field of the fixture
 * (identities, addresses, LEIs, …) is simulated and constant across runs, so it's left untouched.
 *
 * Also independently recomputes attCommitment (see attestation.js) from the revealed fields and checks
 * it against the attCommitment that was actually anchored on-chain for this run, so "it's the same
 * cryptographic object" is verifiable on-screen instead of just asserted. */
export async function openWithViewKey(run) {
  const ivms = {
    ...IVMS101_ATTESTATION,
    transfer: { ...IVMS101_ATTESTATION.transfer, amount: Number(run?.amount).toFixed(2) }
  };
  const commitmentMatch = recomputeAttCommitment(run) === String(run.attCommitment);
  return { ivms, commitmentMatch };
}

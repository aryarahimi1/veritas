// Live engine: in-browser ZK proof -> fresh on-chain submission. Verified end-to-end (see live-test.mjs).
// snarkjs runs from the prebuilt /snarkjs.min.js (avoids bundling ffjavascript's node builtins).
import { Client, networks, Keypair, contract } from '$lib/veritas-client/dist/index.js';
import { buildInput, randomSettlementRef } from './witness.js';
import { recomputeAttCommitment } from './attestation.js';
import { encodeProof } from './proof.js';
import { IVMS101_ATTESTATION } from './fixtures.js';

const { basicNodeSigner } = contract;
const RPC = 'https://soroban-testnet.stellar.org';
const { networkPassphrase, contractId } = networks.testnet;
const WASM = '/circuit/veritas.wasm';
const ZKEY = '/circuit/veritas_final.zkey';

let _snarkjs;
let _account; // funded once and reused
let _wallet = 'ephemeral'; // 'ephemeral' | 'freighter'
export const setWallet = (kind) => { _wallet = kind; _account = null; };
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

// ponytail: optional Freighter path — needs the extension (testnet + funded). freighter-api resolves
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

async function ensureAccount() {
  if (_account) return _account;
  if (_wallet === 'freighter') {
    try {
      return (_account = await freighter());
    } catch {
      _wallet = 'ephemeral'; // extension missing/denied/wrong-network -> graceful fallback
    }
  }
  return (_account = await ephemeral());
}

const newClient = (acct) =>
  new Client({ contractId, rpcUrl: RPC, networkPassphrase, publicKey: acct.publicKey, signTransaction: acct.signTransaction });

/** The headline path: prove `amount` in-browser, submit a BRAND-NEW tx. Throws on failure (caller falls back). */
export async function anchorLive(amount, onStep = () => {}) {
  onStep('loading');
  const snarkjs = await loadSnarkjs();
  const acct = await ensureAccount();
  onStep('proving');
  const settlementRef = randomSettlementRef();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(buildInput(amount, settlementRef), WASM, ZKEY);
  onStep('submitting');
  const enc = encodeProof(proof);
  const tx = await newClient(acct).submit_compliance({
    submitter: acct.publicKey,
    proof: { a: enc.a, b: enc.b, c: enc.c },
    pub_signals: publicSignals.map((s) => BigInt(s)),
    settlement_ref: settlementRef
  });
  const sent = await tx.signAndSend();
  return {
    live: true,
    txHash: sent.sendTransactionResponse?.hash,
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
    const onChain = m.includes('#3') || /ProofInvalid|Error\(Contract/i.test(m);
    return onChain
      ? { rejected: true, reason: /ProofInvalid/i.test(m) || m.includes('#3') ? 'ProofInvalid' : m.split('\n')[0] }
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

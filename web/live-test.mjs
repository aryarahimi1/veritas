// End-to-end check of the LIVE Phase-10 pipeline (Node, the same primitives the browser uses):
// fund -> REAL settlement payment (A -> fresh B) -> derive settlementRef from its tx hash ->
// snarkjs prove -> JS encode -> submit_compliance -> assert the anchored settlementRef equals the
// payment-derived ref (i.e. the payment and its compliance proof share one on-chain settlement id).
// Run from web/:  node live-test.mjs
import * as snarkjs from 'snarkjs';
import { Keypair, Horizon, TransactionBuilder, Operation, Memo, BASE_FEE } from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/contract';
import { Client, networks } from './src/lib/veritas-client/dist/index.js';
import { buildInput } from './src/lib/witness.js';
import { encodeProof } from './src/lib/proof.js';

const rpcUrl = 'https://soroban-testnet.stellar.org';
const horizonUrl = 'https://horizon-testnet.stellar.org';
const { networkPassphrase, contractId } = networks.testnet;
const B = '/Users/arya/Desktop/projects/veritas/circuits/build';
const FIELD = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n; // BLS12-381 scalar field r
const EXPLORER = 'https://stellar.expert/explorer/testnet/tx/';

const kp = Keypair.random();
console.log('funding ephemeral VASP-A', kp.publicKey());
await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`);
const { signTransaction } = basicNodeSigner(kp, networkPassphrase);

// 1) real settlement payment A -> fresh B (createAccount is the canonical send-to-new-account op)
const horizon = new Horizon.Server(horizonUrl);
const source = await horizon.loadAccount(kp.publicKey());
const beneficiary = Keypair.random();
const payTx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase })
  .addOperation(Operation.createAccount({ destination: beneficiary.publicKey(), startingBalance: '1.5' }))
  .addMemo(Memo.text('Veritas settlement'))
  .setTimeout(60)
  .build();
payTx.sign(kp);
const payRes = await horizon.submitTransaction(payTx);
console.log('SETTLEMENT PAYMENT tx:', payRes.hash);
const settlementRef = BigInt('0x' + payRes.hash) % FIELD;

// 2) prove, bound to that settlement
const amount = 1000 + Math.floor(Math.random() * 9000);
console.log('proving (amount =', amount, ', settlementRef derived from the payment)…');
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  buildInput(amount, settlementRef),
  `${B}/veritas_js/veritas.wasm`,
  `${B}/veritas_final.zkey`
);
const enc = encodeProof(proof);

// 3) anchor compliance
const client = new Client({ contractId, rpcUrl, networkPassphrase, publicKey: kp.publicKey(), signTransaction });
const tx = await client.submit_compliance({
  submitter: kp.publicKey(),
  proof: { a: enc.a, b: enc.b, c: enc.c },
  pub_signals: publicSignals.map((s) => BigInt(s)),
  settlement_ref: settlementRef
});
const sent = await tx.signAndSend();
const hash = sent.sendTransactionResponse?.hash;
console.log('COMPLIANCE ANCHOR tx :', hash);

// 4) assert the two share one settlement id
const anchoredRef = BigInt(publicSignals[3]);
const okRef = anchoredRef === settlementRef;
console.log('\nsettlementRef (payment-derived):', settlementRef.toString());
console.log('settlementRef (anchored proof) :', anchoredRef.toString());
console.log(okRef ? 'PASS: payment and compliance proof share one settlement id' : 'FAIL: settlement ids differ');
console.log('\npayment    :', EXPLORER + payRes.hash);
console.log('compliance :', EXPLORER + hash);
process.exit(okRef ? 0 : 1);

// End-to-end check of the LIVE pipeline (Node, same primitives the browser uses):
// fresh witness -> snarkjs prove -> JS encode -> ephemeral keypair -> submit_compliance -> fresh tx.
// Run from web/:  node live-test.mjs
import * as snarkjs from 'snarkjs';
import { Keypair } from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/contract';
import { Client, networks } from './src/lib/veritas-client/dist/index.js';
import { buildInput, randomSettlementRef } from './src/lib/witness.js';
import { encodeProof } from './src/lib/proof.js';

const rpcUrl = 'https://soroban-testnet.stellar.org';
const { networkPassphrase, contractId } = networks.testnet;
const B = '/Users/arya/Desktop/projects/veritas/circuits/build';

const amount = 1000 + Math.floor(Math.random() * 9000);
const settlementRef = randomSettlementRef();
console.log('proving (amount =', amount, ', fresh settlementRef)…');
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  buildInput(amount, settlementRef),
  `${B}/veritas_js/veritas.wasm`,
  `${B}/veritas_final.zkey`
);
console.log('publicSignals =', publicSignals);
const enc = encodeProof(proof);

const kp = Keypair.random();
console.log('funding ephemeral source', kp.publicKey());
await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`);
const { signTransaction } = basicNodeSigner(kp, networkPassphrase);
const client = new Client({ contractId, rpcUrl, networkPassphrase, publicKey: kp.publicKey(), signTransaction });

console.log('submitting submit_compliance…');
const tx = await client.submit_compliance({
  submitter: kp.publicKey(),
  proof: { a: enc.a, b: enc.b, c: enc.c },
  pub_signals: publicSignals.map((s) => BigInt(s)),
  settlement_ref: settlementRef
});
const sent = await tx.signAndSend();
const hash = sent.sendTransactionResponse?.hash;
console.log('TX HASH:', hash);
console.log('result:', JSON.stringify(tx.result));
console.log('explorer: https://stellar.expert/explorer/testnet/tx/' + hash);

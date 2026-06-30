import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CB6DCNEGNXP7WQB3XVDABZ2TUNM5DSK4VYXLCE4OZWGXMGSZRGYBOFWV",
  }
} as const

export const Errors = {
  1: {message:"NotInitialized"},
  3: {message:"ProofInvalid"},
  4: {message:"RegistryMismatch"},
  5: {message:"SettlementMismatch"},
  6: {message:"ThresholdMismatch"},
  7: {message:"AlreadyAnchored"},
  8: {message:"MalformedInputs"}
}


export interface Proof {
  a: Buffer;
  b: Buffer;
  c: Buffer;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "RegistryRoot", values: void} | {tag: "Vk", values: void} | {tag: "Attestation", values: readonly [u256]};


/**
 * The public compliance receipt anyone can read. Contains NO personal data.
 */
export interface Attestation {
  /**
 * regulator-view-key-openable commitment to the full attestation
 */
att_commitment: u256;
  /**
 * 1 = full IVMS101 (>= threshold), 0 = reduced (< threshold)
 */
bracket: u32;
  ledger: u32;
  /**
 * binds this receipt to the exact settlement
 */
settlement_ref: u256;
  /**
 * the address that anchored it (provenance; not proof-bound — see SECURITY.md)
 */
submitter: string;
}


export interface VerificationKey {
  alpha: Buffer;
  beta: Buffer;
  delta: Buffer;
  gamma: Buffer;
  ic: Array<Buffer>;
}

export interface Client {
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The deploying authority recorded at construction (the VK/registry are immutable post-deploy).
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a registry_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The pinned licensed-VASP registry root.
   */
  registry_root: (options?: MethodOptions) => Promise<AssembledTransaction<Option<u256>>>

  /**
   * Construct and simulate a get_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read the public compliance receipt for a settlement (no personal data).
   */
  get_attestation: ({settlement_ref}: {settlement_ref: u256}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Attestation>>>

  /**
   * Construct and simulate a submit_compliance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Anchor a compliance proof to a settlement. The submitting VASP must authorize.
   * 
   * `pub_signals` = [bracket, registryRoot, attCommitment, settlementRef, threshold] (snarkjs order).
   */
  submit_compliance: ({submitter, proof, pub_signals, settlement_ref}: {submitter: string, proof: Proof, pub_signals: Array<u256>, settlement_ref: u256}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, registry_root, vk}: {admin: string, registry_root: u256, vk: VerificationKey},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, registry_root, vk}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAF1UaGUgZGVwbG95aW5nIGF1dGhvcml0eSByZWNvcmRlZCBhdCBjb25zdHJ1Y3Rpb24gKHRoZSBWSy9yZWdpc3RyeSBhcmUgaW1tdXRhYmxlIHBvc3QtZGVwbG95KS4AAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABwAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADFByb29mSW52YWxpZAAAAAMAAAAAAAAAEFJlZ2lzdHJ5TWlzbWF0Y2gAAAAEAAAAAAAAABJTZXR0bGVtZW50TWlzbWF0Y2gAAAAAAAUAAAAAAAAAEVRocmVzaG9sZE1pc21hdGNoAAAAAAAABgAAAAAAAAAPQWxyZWFkeUFuY2hvcmVkAAAAAAcAAAAAAAAAD01hbGZvcm1lZElucHV0cwAAAAAI",
        "AAAAAQAAAAAAAAAAAAAABVByb29mAAAAAAAAAwAAAAAAAAABYQAAAAAAA+4AAABgAAAAAAAAAAFiAAAAAAAD7gAAAMAAAAAAAAAAAWMAAAAAAAPuAAAAYA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAMUmVnaXN0cnlSb290AAAAAAAAAAAAAAACVmsAAAAAAAEAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAEAAAAM",
        "AAAAAAAAACdUaGUgcGlubmVkIGxpY2Vuc2VkLVZBU1AgcmVnaXN0cnkgcm9vdC4AAAAADXJlZ2lzdHJ5X3Jvb3QAAAAAAAAAAAAAAQAAA+gAAAAM",
        "AAAAAAAAALxQaW4gdGhlIGFkbWluLCB0aGUgbGljZW5zZWQtVkFTUCByZWdpc3RyeSByb290LCBhbmQgdGhlIFZlcml0YXMgdmVyaWZpY2F0aW9uIGtleSDigJQgYXRvbWljYWxseSBhdApkZXBsb3kgdGltZSwgc28gdGhlcmUgaXMgbm8gd2luZG93IGZvciBhIGZyb250LXJ1bm5lciB0byBwaW4gYSBtYWxpY2lvdXMgVksgKEhJR0gtMSBmaXgpLgAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAA1yZWdpc3RyeV9yb290AAAAAAAADAAAAAAAAAACdmsAAAAAB9AAAAAPVmVyaWZpY2F0aW9uS2V5AAAAAAA=",
        "AAAAAQAAAElUaGUgcHVibGljIGNvbXBsaWFuY2UgcmVjZWlwdCBhbnlvbmUgY2FuIHJlYWQuIENvbnRhaW5zIE5PIHBlcnNvbmFsIGRhdGEuAAAAAAAAAAAAAAtBdHRlc3RhdGlvbgAAAAAFAAAAPnJlZ3VsYXRvci12aWV3LWtleS1vcGVuYWJsZSBjb21taXRtZW50IHRvIHRoZSBmdWxsIGF0dGVzdGF0aW9uAAAAAAAOYXR0X2NvbW1pdG1lbnQAAAAAAAwAAAA6MSA9IGZ1bGwgSVZNUzEwMSAoPj0gdGhyZXNob2xkKSwgMCA9IHJlZHVjZWQgKDwgdGhyZXNob2xkKQAAAAAAB2JyYWNrZXQAAAAABAAAAAAAAAAGbGVkZ2VyAAAAAAAEAAAAKmJpbmRzIHRoaXMgcmVjZWlwdCB0byB0aGUgZXhhY3Qgc2V0dGxlbWVudAAAAAAADnNldHRsZW1lbnRfcmVmAAAAAAAMAAAATnRoZSBhZGRyZXNzIHRoYXQgYW5jaG9yZWQgaXQgKHByb3ZlbmFuY2U7IG5vdCBwcm9vZi1ib3VuZCDigJQgc2VlIFNFQ1VSSVRZLm1kKQAAAAAACXN1Ym1pdHRlcgAAAAAAABM=",
        "AAAAAAAAAEdSZWFkIHRoZSBwdWJsaWMgY29tcGxpYW5jZSByZWNlaXB0IGZvciBhIHNldHRsZW1lbnQgKG5vIHBlcnNvbmFsIGRhdGEpLgAAAAAPZ2V0X2F0dGVzdGF0aW9uAAAAAAEAAAAAAAAADnNldHRsZW1lbnRfcmVmAAAAAAAMAAAAAQAAA+gAAAfQAAAAC0F0dGVzdGF0aW9uAA==",
        "AAAAAAAAALFBbmNob3IgYSBjb21wbGlhbmNlIHByb29mIHRvIGEgc2V0dGxlbWVudC4gVGhlIHN1Ym1pdHRpbmcgVkFTUCBtdXN0IGF1dGhvcml6ZS4KCmBwdWJfc2lnbmFsc2AgPSBbYnJhY2tldCwgcmVnaXN0cnlSb290LCBhdHRDb21taXRtZW50LCBzZXR0bGVtZW50UmVmLCB0aHJlc2hvbGRdIChzbmFya2pzIG9yZGVyKS4AAAAAAAARc3VibWl0X2NvbXBsaWFuY2UAAAAAAAAEAAAAAAAAAAlzdWJtaXR0ZXIAAAAAAAATAAAAAAAAAAVwcm9vZgAAAAAAB9AAAAAFUHJvb2YAAAAAAAAAAAAAC3B1Yl9zaWduYWxzAAAAA+oAAAAMAAAAAAAAAA5zZXR0bGVtZW50X3JlZgAAAAAADAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAQAAAAAAAAAAAAAAD1ZlcmlmaWNhdGlvbktleQAAAAAFAAAAAAAAAAVhbHBoYQAAAAAAA+4AAABgAAAAAAAAAARiZXRhAAAD7gAAAMAAAAAAAAAABWRlbHRhAAAAAAAD7gAAAMAAAAAAAAAABWdhbW1hAAAAAAAD7gAAAMAAAAAAAAAAAmljAAAAAAPqAAAD7gAAAGA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<Option<string>>,
        registry_root: this.txFromJSON<Option<u256>>,
        get_attestation: this.txFromJSON<Option<Attestation>>,
        submit_compliance: this.txFromJSON<Result<void>>
  }
}
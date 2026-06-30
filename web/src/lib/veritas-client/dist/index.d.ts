import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u256, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CB6DCNEGNXP7WQB3XVDABZ2TUNM5DSK4VYXLCE4OZWGXMGSZRGYBOFWV";
    };
};
export declare const Errors: {
    1: {
        message: string;
    };
    3: {
        message: string;
    };
    4: {
        message: string;
    };
    5: {
        message: string;
    };
    6: {
        message: string;
    };
    7: {
        message: string;
    };
    8: {
        message: string;
    };
};
export interface Proof {
    a: Buffer;
    b: Buffer;
    c: Buffer;
}
export type DataKey = {
    tag: "Admin";
    values: void;
} | {
    tag: "RegistryRoot";
    values: void;
} | {
    tag: "Vk";
    values: void;
} | {
    tag: "Attestation";
    values: readonly [u256];
};
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
    admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>;
    /**
     * Construct and simulate a registry_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * The pinned licensed-VASP registry root.
     */
    registry_root: (options?: MethodOptions) => Promise<AssembledTransaction<Option<u256>>>;
    /**
     * Construct and simulate a get_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Read the public compliance receipt for a settlement (no personal data).
     */
    get_attestation: ({ settlement_ref }: {
        settlement_ref: u256;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<Attestation>>>;
    /**
     * Construct and simulate a submit_compliance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Anchor a compliance proof to a settlement. The submitting VASP must authorize.
     *
     * `pub_signals` = [bracket, registryRoot, attCommitment, settlementRef, threshold] (snarkjs order).
     */
    submit_compliance: ({ submitter, proof, pub_signals, settlement_ref }: {
        submitter: string;
        proof: Proof;
        pub_signals: Array<u256>;
        settlement_ref: u256;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, registry_root, vk }: {
        admin: string;
        registry_root: u256;
        vk: VerificationKey;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        admin: (json: string) => AssembledTransaction<Option<string>>;
        registry_root: (json: string) => AssembledTransaction<Option<bigint>>;
        get_attestation: (json: string) => AssembledTransaction<Option<Attestation>>;
        submit_compliance: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}

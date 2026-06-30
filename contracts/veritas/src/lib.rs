#![no_std]
//! Veritas — on-chain Travel Rule compliance anchor (Soroban).
//!
//! Verifies a Groth16 (BLS12-381) proof from the Veritas circuit, binds it to the pinned licensed-VASP
//! registry, the FATF threshold, and a specific settlement, then stores a regulator-openable commitment
//! and emits a public "compliant ✓" event carrying NO personal data.
//!
//! Public-signal layout (snarkjs order): [bracket, registryRoot, attCommitment, settlementRef, threshold].
//!
//! Hardened per Phase-2 Code-Review + Security-Engineer audits:
//!  - registry root + VK pinned ATOMICALLY at deploy via `__constructor` (no front-run window).
//!  - cheap binding/replay checks run BEFORE the expensive pairing (fail-fast).
//!  - all public signals are canonicity-checked (`< field order`) to prevent S/S+r dedup bypass.
//!  - the submitting address is recorded in the attestation (provenance).
//!  - storage TTL is extended so the compliance receipts remain durable.
//!  NOTE: `require_auth(submitter)` proves *a* signer, not the originating VASP's identity — binding the
//!  submitter in-circuit is a documented deferred item (see SECURITY.md). The VK/registry are
//!  intentionally immutable post-deploy (no admin backdoor to forge proofs).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    crypto::bls12_381::{Fr, G1Affine, G2Affine},
    panic_with_error, symbol_short, vec, Address, Bytes, Env, Vec, U256,
};

#[contracttype]
#[derive(Clone)]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

#[contracttype]
#[derive(Clone)]
pub struct Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

#[contracttype]
pub enum DataKey {
    Admin,
    RegistryRoot,
    Vk,
    Attestation(U256), // keyed by canonical settlementRef
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    ProofInvalid = 3,
    RegistryMismatch = 4,
    SettlementMismatch = 5,
    ThresholdMismatch = 6,
    AlreadyAnchored = 7,
    MalformedInputs = 8,
}

/// The public compliance receipt anyone can read. Contains NO personal data.
#[contracttype]
#[derive(Clone)]
pub struct Attestation {
    /// 1 = full IVMS101 (>= threshold), 0 = reduced (< threshold)
    pub bracket: u32,
    /// regulator-view-key-openable commitment to the full attestation
    pub att_commitment: U256,
    /// binds this receipt to the exact settlement
    pub settlement_ref: U256,
    /// the address that anchored it (provenance; not proof-bound — see SECURITY.md)
    pub submitter: Address,
    pub ledger: u32,
}

/// FATF data-sharing threshold the circuit was built against (the contract pins it).
const THRESHOLD: u32 = 1000;
/// Expected number of IC points = nPublic (5) + 1.
const IC_LEN: u32 = 6;

// Public-signal indices (snarkjs order).
const I_BRACKET: u32 = 0;
const I_REGISTRY: u32 = 1;
const I_ATT: u32 = 2;
const I_SETTLEMENT: u32 = 3;
const I_THRESHOLD: u32 = 4;

// TTL horizons (~5s/ledger): keep compliance records durable.
const TTL_THRESHOLD: u32 = 17280 * 7; // ~7 days
const TTL_EXTEND: u32 = 17280 * 30; // ~30 days

#[contract]
pub struct Veritas;

#[contractimpl]
impl Veritas {
    /// Pin the admin, the licensed-VASP registry root, and the Veritas verification key — atomically at
    /// deploy time, so there is no window for a front-runner to pin a malicious VK (HIGH-1 fix).
    pub fn __constructor(env: Env, admin: Address, registry_root: U256, vk: VerificationKey) {
        if vk.ic.len() != IC_LEN {
            panic_with_error!(&env, Error::MalformedInputs);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RegistryRoot, &registry_root);
        env.storage().instance().set(&DataKey::Vk, &vk);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    /// Anchor a compliance proof to a settlement. The submitting VASP must authorize.
    ///
    /// `pub_signals` = [bracket, registryRoot, attCommitment, settlementRef, threshold] (snarkjs order).
    pub fn submit_compliance(
        env: Env,
        submitter: Address,
        proof: Proof,
        pub_signals: Vec<U256>,
        settlement_ref: U256,
    ) -> Result<(), Error> {
        submitter.require_auth();

        // --- cheap checks first (fail-fast; the pairing is the expensive op) ---
        if pub_signals.len() != 5 {
            return Err(Error::MalformedInputs);
        }
        // Canonicity: every signal must be a canonical field element (< r), else S and S+r collide and
        // the same proof could be anchored twice under "different" settlements (MED-1 fix).
        let r = Self::field_order(&env);
        for i in 0..pub_signals.len() {
            if pub_signals.get(i).unwrap() >= r {
                return Err(Error::MalformedInputs);
            }
        }

        let registry_root: U256 = env
            .storage()
            .instance()
            .get(&DataKey::RegistryRoot)
            .ok_or(Error::NotInitialized)?;

        if pub_signals.get(I_REGISTRY).unwrap() != registry_root {
            return Err(Error::RegistryMismatch);
        }
        if pub_signals.get(I_SETTLEMENT).unwrap() != settlement_ref {
            return Err(Error::SettlementMismatch);
        }
        if pub_signals.get(I_THRESHOLD).unwrap() != U256::from_u32(&env, THRESHOLD) {
            return Err(Error::ThresholdMismatch);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Attestation(settlement_ref.clone()))
        {
            return Err(Error::AlreadyAnchored);
        }

        // --- expensive check last: the real BLS12-381 Groth16 pairing ---
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .ok_or(Error::NotInitialized)?;
        if !Self::verify_groth16(&env, &vk, &proof, &pub_signals) {
            return Err(Error::ProofInvalid);
        }

        // --- store the public compliance receipt (no PII) and emit the ✓ ---
        let bracket = if pub_signals.get(I_BRACKET).unwrap() == U256::from_u32(&env, 1) {
            1u32
        } else {
            0u32
        };
        let att_commitment = pub_signals.get(I_ATT).unwrap();
        let att = Attestation {
            bracket,
            att_commitment: att_commitment.clone(),
            settlement_ref: settlement_ref.clone(),
            submitter,
            ledger: env.ledger().sequence(),
        };
        let key = DataKey::Attestation(settlement_ref.clone());
        env.storage().persistent().set(&key, &att);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events()
            .publish((symbol_short!("verified"), settlement_ref), (bracket, att_commitment));
        Ok(())
    }

    /// Read the public compliance receipt for a settlement (no personal data).
    pub fn get_attestation(env: Env, settlement_ref: U256) -> Option<Attestation> {
        env.storage()
            .persistent()
            .get(&DataKey::Attestation(settlement_ref))
    }

    /// The pinned licensed-VASP registry root.
    pub fn registry_root(env: Env) -> Option<U256> {
        env.storage().instance().get(&DataKey::RegistryRoot)
    }

    /// The deploying authority recorded at construction (the VK/registry are immutable post-deploy).
    pub fn admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    // --- internal ---

    /// BLS12-381 scalar field order r (the canonical bound for public signals).
    fn field_order(env: &Env) -> U256 {
        const R: [u8; 32] = [
            0x73, 0xed, 0xa7, 0x53, 0x29, 0x9d, 0x7d, 0x48, 0x33, 0x39, 0xd8, 0x08, 0x09, 0xa1, 0xd8,
            0x05, 0x53, 0xbd, 0xa4, 0x02, 0xff, 0xfe, 0x5b, 0xfe, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00,
            0x00, 0x01,
        ];
        U256::from_be_bytes(env, &Bytes::from_array(env, &R))
    }

    /// Groth16 (BLS12-381) verification, adapted from soroban-examples/groth16_verifier.
    /// The BLS host functions validate point membership (on-curve + correct subgroup) for A/B/C, so a
    /// malformed proof aborts the host call rather than returning `ProofInvalid` — acceptable here.
    fn verify_groth16(
        env: &Env,
        vk: &VerificationKey,
        proof: &Proof,
        pub_signals: &Vec<U256>,
    ) -> bool {
        let bls = env.crypto().bls12_381();
        if pub_signals.len() + 1 != vk.ic.len() {
            return false;
        }
        // vk_x = ic[0] + sum(pub_signals[i] * ic[i+1])
        let mut vk_x = vk.ic.get(0).unwrap();
        for i in 0..pub_signals.len() {
            let s = Fr::from_u256(pub_signals.get(i).unwrap());
            let v = vk.ic.get(i + 1).unwrap();
            let prod = bls.g1_mul(&v, &s);
            vk_x = bls.g1_add(&vk_x, &prod);
        }
        // e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1
        let neg_a = -proof.a.clone();
        let vp1 = vec![env, neg_a, vk.alpha.clone(), vk_x, proof.c.clone()];
        let vp2 = vec![
            env,
            proof.b.clone(),
            vk.beta.clone(),
            vk.gamma.clone(),
            vk.delta.clone(),
        ];
        bls.pairing_check(vp1, vp2)
    }
}

mod test;

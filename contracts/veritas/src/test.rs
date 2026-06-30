#![cfg(test)]
use super::*;
use soroban_sdk::{
    crypto::bls12_381::{G1Affine, G2Affine},
    testutils::Address as _,
    vec, Address, Bytes, Env, U256,
};

fn dummy_vk(env: &Env) -> VerificationKey {
    let g1 = G1Affine::from_array(env, &[0u8; 96]);
    let g2 = G2Affine::from_array(env, &[0u8; 192]);
    VerificationKey {
        alpha: g1.clone(),
        beta: g2.clone(),
        gamma: g2.clone(),
        delta: g2,
        ic: vec![env, g1.clone(), g1.clone(), g1.clone(), g1.clone(), g1.clone(), g1], // 6 IC
    }
}

fn dummy_proof(env: &Env) -> Proof {
    Proof {
        a: G1Affine::from_array(env, &[0u8; 96]),
        b: G2Affine::from_array(env, &[0u8; 192]),
        c: G1Affine::from_array(env, &[0u8; 96]),
    }
}

fn sig5(env: &Env, a: u32, b: u32, c: u32, d: u32, e: u32) -> Vec<U256> {
    vec![
        env,
        U256::from_u32(env, a),
        U256::from_u32(env, b),
        U256::from_u32(env, c),
        U256::from_u32(env, d),
        U256::from_u32(env, e),
    ]
}

const ROOT: u32 = 12345;

fn setup() -> (Env, VeritasClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(
        Veritas {},
        (admin, U256::from_u32(&env, ROOT), dummy_vk(&env)),
    );
    (env.clone(), VeritasClient::new(&env, &id))
}

#[test]
fn constructor_pins_registry_root() {
    let (env, client) = setup();
    assert_eq!(client.registry_root(), Some(U256::from_u32(&env, ROOT)));
}

#[test]
fn no_attestation_before_submit() {
    let (env, client) = setup();
    assert!(client.get_attestation(&U256::from_u32(&env, 1)).is_none());
}

#[test]
fn malformed_length_rejected() {
    let (env, client) = setup();
    let s = Address::generate(&env);
    let bad = vec![&env, U256::from_u32(&env, 1), U256::from_u32(&env, 2)];
    let res = client.try_submit_compliance(&s, &dummy_proof(&env), &bad, &U256::from_u32(&env, 7));
    assert_eq!(res, Err(Ok(Error::MalformedInputs)));
}

#[test]
fn registry_mismatch_rejected() {
    let (env, client) = setup();
    let s = Address::generate(&env);
    // registryRoot signal (index 1) = 99999 != pinned 12345
    let sigs = sig5(&env, 1, 99999, 2, 7, 1000);
    let res = client.try_submit_compliance(&s, &dummy_proof(&env), &sigs, &U256::from_u32(&env, 7));
    assert_eq!(res, Err(Ok(Error::RegistryMismatch)));
}

#[test]
fn settlement_mismatch_rejected() {
    let (env, client) = setup();
    let s = Address::generate(&env);
    // settlement signal (index 3) = 8 != arg 7
    let sigs = sig5(&env, 1, ROOT, 2, 8, 1000);
    let res = client.try_submit_compliance(&s, &dummy_proof(&env), &sigs, &U256::from_u32(&env, 7));
    assert_eq!(res, Err(Ok(Error::SettlementMismatch)));
}

#[test]
fn threshold_mismatch_rejected() {
    let (env, client) = setup();
    let s = Address::generate(&env);
    // threshold signal (index 4) = 999 != pinned 1000
    let sigs = sig5(&env, 1, ROOT, 2, 7, 999);
    let res = client.try_submit_compliance(&s, &dummy_proof(&env), &sigs, &U256::from_u32(&env, 7));
    assert_eq!(res, Err(Ok(Error::ThresholdMismatch)));
}

#[test]
fn noncanonical_signal_rejected() {
    let (env, client) = setup();
    let s = Address::generate(&env);
    // a signal >= field order r (here 2^256-1) must be rejected before any binding check
    let huge = U256::from_be_bytes(&env, &Bytes::from_array(&env, &[0xffu8; 32]));
    let sigs = vec![
        &env,
        huge,
        U256::from_u32(&env, ROOT),
        U256::from_u32(&env, 2),
        U256::from_u32(&env, 7),
        U256::from_u32(&env, 1000),
    ];
    let res = client.try_submit_compliance(&s, &dummy_proof(&env), &sigs, &U256::from_u32(&env, 7));
    assert_eq!(res, Err(Ok(Error::MalformedInputs)));
}

#[test]
fn requires_submitter_auth() {
    // No mock_all_auths: the submitter's require_auth must fail.
    let env = Env::default();
    let admin = Address::generate(&env);
    let id = env.register(
        Veritas {},
        (admin, U256::from_u32(&env, ROOT), dummy_vk(&env)),
    );
    let client = VeritasClient::new(&env, &id);
    let s = Address::generate(&env);
    let res = client.try_submit_compliance(
        &s,
        &dummy_proof(&env),
        &sig5(&env, 1, ROOT, 2, 7, 1000),
        &U256::from_u32(&env, 7),
    );
    assert!(res.is_err());
}

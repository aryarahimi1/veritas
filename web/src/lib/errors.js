// The Veritas contract's 7 distinct error codes (contracts/veritas/src/lib.rs `enum Error`), mapped to
// human-readable names + one-line explanations. Surfacing the real, named on-chain error (instead of a
// single generic "failed") is what makes a forced rejection read as a genuine contract response.
export const CONTRACT_ERRORS = {
  1: { name: 'NotInitialized', msg: 'the contract was not initialized' },
  3: { name: 'ProofInvalid', msg: 'the Groth16 proof failed on-chain pairing verification' },
  4: { name: 'RegistryMismatch', msg: 'the registry root did not match the pinned licensed-VASP root' },
  5: { name: 'SettlementMismatch', msg: 'the settlement reference did not match the submitted one' },
  6: { name: 'ThresholdMismatch', msg: 'the FATF threshold did not match the contract constant' },
  7: { name: 'AlreadyAnchored', msg: 'this settlement was already anchored (replay rejected)' },
  8: { name: 'MalformedInputs', msg: 'the public signals were malformed or non-canonical' }
};

/**
 * Parse a Soroban error string (e.g. `Error(Contract, #3)` or a message containing "ProofInvalid")
 * into `{ code, name, msg }`, or null if it is not a recognised contract error. Matches by numeric
 * code first, then by error name, so it is robust to SDK message-format changes.
 */
export function parseContractError(message) {
  const m = String(message ?? '');
  const hit = m.match(/#(\d+)/);
  const code = hit ? Number(hit[1]) : null;
  if (code != null && CONTRACT_ERRORS[code]) return { code, ...CONTRACT_ERRORS[code] };
  for (const [c, info] of Object.entries(CONTRACT_ERRORS)) {
    if (new RegExp(`\\b${info.name}\\b`, 'i').test(m)) return { code: Number(c), ...info };
  }
  return null;
}

/** Short label for the fail card / tamper readout, e.g. "#3 ProofInvalid". */
export function contractErrorLabel(message) {
  const ce = parseContractError(message);
  return ce ? `#${ce.code} ${ce.name}` : null;
}

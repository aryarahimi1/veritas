// Demo fixtures wired to the REAL on-chain Veritas deployment (Stellar testnet).
// Every run proves live in-browser and submits a fresh tx (see veritas.js's anchorLive); these fixtures
// back the graceful cached-fallback path (TX.submit, PUBLIC_SIGNALS) used only if that live call fails,
// plus the synthetic IVMS101 attestation the regulator view-key reveals. See SECURITY.md for the full
// real-vs-simulated breakdown. Everything here is independently checkable by a judge.

export const NETWORK = 'testnet';
export const EXPLORER = 'https://stellar.expert/explorer/testnet';

// Deployed contracts
export const VERITAS_CONTRACT = 'CB6DCNEGNXP7WQB3XVDABZ2TUNM5DSK4VYXLCE4OZWGXMGSZRGYBOFWV';
export const GROTH16_VERIFIER = 'CBOLT6FYCO4JKADIN2W66ZZJ4UDC3IW4SMG2MHYFZOIYF273LOI2PXOO';

// Real transactions (clickable on stellar.expert). Registry + VK are pinned atomically at deploy via
// the contract's __constructor; this is the compliance-anchor transaction.
export const TX = {
  submit: '20c48e426a3bf44b7a719226f06db8f919da9b3028fc2f6ce20355554ddedc28'
};

// The proof's public signals (snarkjs order). registryRoot + attCommitment are circuit-derived outputs.
export const PUBLIC_SIGNALS = {
  bracket: 1,
  registryRoot: '45278072792433124470777958283057467202189215683085668573919922295261796642154',
  attCommitment: '5408308759447454863842711105285429093958858093295668608020638075467636608655',
  settlementRef: '2573423666217965037452880345879372805356662833',
  threshold: 1000
};

// The cross-VASP transfer in the demo (the amount is HIDDEN on-chain; only the bracket is proven).
export const TRANSFER = {
  originator: 'Helvetia Digital AG',
  originatorJurisdiction: 'CH',
  beneficiary: 'Meridian Exchange Ltd',
  beneficiaryJurisdiction: 'SG',
  amount: 4200,
  asset: 'USDC'
};

// What EVERYONE on-chain sees — the public compliance receipt. No personal data.
export const PUBLIC_RECEIPT = {
  compliant: true,
  bracket: 1, // 1 = full IVMS101 data exchanged (>= FATF threshold)
  attCommitment: PUBLIC_SIGNALS.attCommitment,
  settlementRef: PUBLIC_SIGNALS.settlementRef
};

// What ONLY a regulator holding the view key can open — the full IVMS101 attestation, reconstructed
// and checked against the on-chain attCommitment. (Synthetic demo data; the IVMS101 *format* is real.)
export const IVMS101_ATTESTATION = {
  originator: {
    originatorPersons: [
      {
        naturalPerson: {
          name: { nameIdentifier: [{ primaryIdentifier: 'Müller', secondaryIdentifier: 'Anna', nameIdentifierType: 'LEGL' }] },
          geographicAddress: [{ addressType: 'HOME', country: 'CH', townName: 'Zürich', addressLine: ['Bahnhofstrasse 12'] }],
          nationalIdentification: { nationalIdentifier: 'CHE-756.1234.5678', nationalIdentifierType: 'RAID', countryOfIssue: 'CH' },
          dateAndPlaceOfBirth: { dateOfBirth: '1989-04-17', placeOfBirth: 'Basel, CH' }
        }
      }
    ],
    accountNumber: ['CH93-0076-2011-6238-5295-7']
  },
  beneficiary: {
    beneficiaryPersons: [
      {
        naturalPerson: {
          name: { nameIdentifier: [{ primaryIdentifier: 'Tan', secondaryIdentifier: 'Wei Ling', nameIdentifierType: 'LEGL' }] },
          geographicAddress: [{ addressType: 'HOME', country: 'SG', townName: 'Singapore', addressLine: ['10 Marina Boulevard'] }]
        }
      }
    ],
    accountNumber: ['SG12-3456-7890-1234']
  },
  originatingVASP: { name: 'Helvetia Digital AG', lei: '506700GE1G29325QX363', country: 'CH' },
  beneficiaryVASP: { name: 'Meridian Exchange Ltd', lei: '5299000F4XGCT0BR6E08', country: 'SG' },
  transfer: { amount: '4200.00', asset: 'USDC', settlementRef: PUBLIC_SIGNALS.settlementRef },
  ivms101Version: '101.2023'
};

<script>
  import { anchorOnChain, readOnChainAttestation, openWithViewKey } from '$lib/veritas.js';
  import { TRANSFER, EXPLORER, VERITAS_CONTRACT, PUBLIC_SIGNALS } from '$lib/fixtures.js';

  let stage = 'idle'; // idle -> anchoring -> anchored
  let busy = false;
  let error = '';
  let txHash = '';
  let receipt = null;
  let liveRead = null;
  let regulator = false;
  let opened = null;

  const short = (s, n = 10) => (s && String(s).length > 2 * n ? `${String(s).slice(0, n)}…${String(s).slice(-n)}` : s ?? '—');

  // Flatten the IVMS101 record into a render-safe view (optional chaining everywhere) so the reveal —
  // the climax of the demo — can never throw on a missing field.
  $: orig = opened?.ivms?.originator?.originatorPersons?.[0]?.naturalPerson;
  $: ben = opened?.ivms?.beneficiary?.beneficiaryPersons?.[0]?.naturalPerson;
  $: view = opened
    ? {
        origName:
          [orig?.name?.nameIdentifier?.[0]?.secondaryIdentifier, orig?.name?.nameIdentifier?.[0]?.primaryIdentifier]
            .filter(Boolean)
            .join(' ') || '—',
        origAddr:
          [orig?.geographicAddress?.[0]?.addressLine?.[0], orig?.geographicAddress?.[0]?.townName]
            .filter(Boolean)
            .join(', ') + (orig?.geographicAddress?.[0]?.country ? ` (${orig.geographicAddress[0].country})` : ''),
        origDob: orig?.dateAndPlaceOfBirth?.dateOfBirth ?? '—',
        origVasp: `${opened?.ivms?.originatingVASP?.name ?? '—'} · LEI ${opened?.ivms?.originatingVASP?.lei ?? '—'}`,
        benName:
          [ben?.name?.nameIdentifier?.[0]?.secondaryIdentifier, ben?.name?.nameIdentifier?.[0]?.primaryIdentifier]
            .filter(Boolean)
            .join(' ') || '—',
        benAddr:
          [ben?.geographicAddress?.[0]?.addressLine?.[0], ben?.geographicAddress?.[0]?.townName]
            .filter(Boolean)
            .join(', ') + (ben?.geographicAddress?.[0]?.country ? ` (${ben.geographicAddress[0].country})` : ''),
        benVasp: `${opened?.ivms?.beneficiaryVASP?.name ?? '—'} · LEI ${opened?.ivms?.beneficiaryVASP?.lei ?? '—'}`,
        amount: opened?.ivms?.transfer?.amount ?? '—',
        asset: opened?.ivms?.transfer?.asset ?? '',
        version: opened?.ivms?.ivms101Version ?? '',
        matches: opened?.matchesCommitment
      }
    : null;

  async function anchor() {
    busy = true;
    stage = 'anchoring';
    error = '';
    try {
      const r = await anchorOnChain();
      txHash = r.txHash;
      receipt = {
        bracket: PUBLIC_SIGNALS.bracket,
        attCommitment: PUBLIC_SIGNALS.attCommitment,
        settlementRef: PUBLIC_SIGNALS.settlementRef
      };
      stage = 'anchored';
    } catch (e) {
      error = 'Anchoring failed — please retry.';
      stage = 'idle';
    } finally {
      busy = false;
    }
  }

  async function readLive() {
    busy = true;
    error = '';
    try {
      liveRead = await readOnChainAttestation();
    } catch (e) {
      error = 'Live read failed.';
    } finally {
      busy = false;
    }
  }

  async function toggleRegulator() {
    if (regulator) {
      regulator = false;
      return;
    }
    busy = true;
    error = '';
    try {
      if (!opened) opened = await openWithViewKey();
      regulator = true;
    } catch (e) {
      error = 'Could not open the attestation.';
    } finally {
      busy = false;
    }
  }

  function reset() {
    stage = 'idle';
    receipt = null;
    liveRead = null;
    regulator = false;
    opened = null;
    error = '';
    txHash = '';
  }
</script>

<main>
  <header>
    <h1 class="logo">⬡ Veritas</h1>
    <p class="tag">Prove the Travel Rule was followed — without putting anyone's identity on-chain.</p>
  </header>

  <!-- 1 · the transfer -->
  <section>
    <h2>1 · A cross-VASP stablecoin transfer</h2>
    <div class="transfer">
      <div class="party">
        <span class="role">Originator VASP</span>
        <b>{TRANSFER.originator}</b>
        <span class="jur">{TRANSFER.originatorJurisdiction}</span>
      </div>
      <div class="arrow">
        <span class="amt">{TRANSFER.amount} {TRANSFER.asset}</span>
        <span class="hidden">🔒 amount hidden on-chain</span>
        →
      </div>
      <div class="party">
        <span class="role">Beneficiary VASP</span>
        <b>{TRANSFER.beneficiary}</b>
        <span class="jur">{TRANSFER.beneficiaryJurisdiction}</span>
      </div>
    </div>
    {#if stage === 'idle'}
      <button on:click={anchor} disabled={busy} aria-busy={busy}>Generate proof + anchor on Stellar →</button>
    {:else if stage === 'anchoring'}
      <button disabled aria-busy="true"><span class="spin" aria-hidden="true">◌</span> proving + verifying on-chain…</button>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>

  {#if stage === 'anchored'}
    <!-- 2 · the public view -->
    <section class="public" aria-live="polite">
      <h2>2 · What everyone on the chain sees</h2>
      <div class="verdict" role="status">✓ Travel-Rule compliant</div>
      <div class="grid">
        <div><span>Data bracket</span><b>{receipt.bracket === 1 ? 'FULL IVMS101 (≥ threshold)' : 'reduced'}</b></div>
        <div><span>Commitment</span><b class="mono">{short(receipt.attCommitment, 8)}</b></div>
        <div><span>Settlement</span><b class="mono">{short(receipt.settlementRef, 8)}</b></div>
      </div>
      <p class="callout">No names. No addresses. No amount. No IVMS101 data. Just a verified, non-repudiable fact — anchored to this settlement, that no party can forge or delete.</p>
      <div class="links">
        <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">↗ verification tx</a>
        <a href={`${EXPLORER}/contract/${VERITAS_CONTRACT}`} target="_blank" rel="noreferrer">↗ contract</a>
        <button class="ghost" on:click={readLive} disabled={busy} aria-busy={busy}>{busy ? '◌ reading…' : '↻ read live from chain'}</button>
        <button class="ghost" on:click={reset} disabled={busy}>↺ run again</button>
      </div>
      {#if liveRead}
        <p class="live" class:cached={!liveRead.live} role="status">
          {liveRead.live ? '🟢 live from Soroban RPC' : '⚪ cached on-chain value (RPC unavailable)'}
          — bracket={liveRead.bracket}, commitment={short(liveRead.attCommitment, 6)}, submitter={short(liveRead.submitter, 5)}
        </p>
      {/if}

      <!-- 3 · the reveal -->
      <div class="reg-toggle">
        <button class="reg" on:click={toggleRegulator} disabled={busy} aria-busy={busy}>
          {#if busy && !regulator}<span class="spin" aria-hidden="true">◌</span> opening…
          {:else if regulator}🙈 hide regulator view
          {:else}🕶️ put on the regulator's glasses{/if}
        </button>
      </div>
    </section>
  {/if}

  {#if regulator && view}
    <section class="reveal" aria-live="polite">
      <h2>3 · What only a regulator (view key) can open</h2>
      <p class="match" role="status">🔑 Reconstructed and verified against the on-chain commitment
        <span class="ok">{view.matches ? '✓ matches' : '—'}</span></p>
      <div class="ivms">
        <div class="col">
          <h3>Originator</h3>
          <b>{view.origName}</b>
          <span>{view.origAddr}</span>
          <span class="dim">DOB {view.origDob}</span>
          <span class="dim">{view.origVasp}</span>
        </div>
        <div class="col">
          <h3>Beneficiary</h3>
          <b>{view.benName}</b>
          <span>{view.benAddr}</span>
          <span class="dim">{view.benVasp}</span>
        </div>
      </div>
      <div class="amount-reveal">Amount: <b>{view.amount} {view.asset}</b>
        <span class="dim">IVMS101 {view.version}</span></div>
      <p class="callout small">Same on-chain ✓ — but the holder of the designated view key reconstructs the full
        IVMS101 attestation bound to <em>this exact settlement</em>, and nothing else. No one else can.</p>
    </section>
  {/if}

  <footer>
    Real BLS12-381 Groth16 proof, verified inside a Soroban contract on Stellar testnet · proofs
    pre-generated · VASPs &amp; IVMS101 data simulated (see SECURITY.md).
  </footer>
</main>

<style>
  :global(body){margin:0;background:#0a0c12;color:#e8ebf2;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
  main{max-width:780px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
  header{margin-bottom:1.5rem}
  .logo{font-size:2rem;font-weight:800;letter-spacing:-.02em;color:#a78bfa;margin:0}
  .tag{color:#8b95a7;margin:.35rem 0 0}
  section{background:#11151f;border:1px solid #1e2738;border-radius:16px;padding:1.3rem 1.5rem;margin-top:1.2rem}
  h2{font-size:.78rem;color:#8b95a7;text-transform:uppercase;letter-spacing:.1em;margin:0 0 1rem}
  .transfer{display:flex;align-items:center;justify-content:space-between;gap:1rem}
  .party{display:flex;flex-direction:column;gap:.15rem;flex:1}
  .role{font-size:.7rem;color:#7c8699;text-transform:uppercase;letter-spacing:.06em}
  .party b{font-size:1.02rem}
  .jur{font-size:.75rem;color:#8b95a7}
  .arrow{display:flex;flex-direction:column;align-items:center;color:#a78bfa;font-size:1.4rem;min-width:140px}
  .amt{font-size:.95rem;font-weight:700;color:#e8ebf2}
  .hidden{font-size:.68rem;color:#f5a623}
  button{margin-top:1.2rem;width:100%;background:#7c5cff;color:#fff;border:0;border-radius:11px;padding:.8rem 1.1rem;font-weight:600;font-size:.95rem;cursor:pointer;transition:filter .15s}
  button:hover:not(:disabled){filter:brightness(1.1)}
  button:disabled{opacity:.6;cursor:default}
  .spin{display:inline-block;animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .error{color:#fca5a5;font-size:.85rem;margin-top:.7rem}
  .verdict{font-size:1.5rem;font-weight:800;color:#34d399;margin-bottom:1rem}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem}
  .grid div{display:flex;flex-direction:column;gap:.2rem;background:#0c1019;border-radius:10px;padding:.7rem .8rem}
  .grid span{font-size:.66rem;color:#7c8699;text-transform:uppercase;letter-spacing:.05em}
  .grid b{font-size:.9rem}
  .mono{font-family:ui-monospace,monospace}
  .callout{background:#0c1019;border-left:3px solid #34d399;border-radius:8px;padding:.7rem .9rem;color:#b9c2d0;font-size:.9rem;margin:1rem 0 .6rem}
  .callout.small{font-size:.82rem;border-left-color:#a78bfa}
  .links{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin-top:.4rem}
  a{color:#60a5fa;text-decoration:none;font-size:.85rem}
  a:hover{text-decoration:underline}
  button.ghost{width:auto;margin:0;background:#1b2333;color:#cdd5e3;padding:.4rem .8rem;font-size:.8rem}
  button.reg{background:#a78bfa;margin-top:1.2rem}
  .live{font-size:.82rem;color:#34d399;margin-top:.6rem;font-family:ui-monospace,monospace}
  .live.cached{color:#9aa6b8}
  .reveal{border-color:#3b2d63;box-shadow:0 0 0 1px #2a2050}
  .match{color:#c4b5fd;font-size:.9rem}
  .ok{color:#34d399;font-weight:700}
  .ivms{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  .col{display:flex;flex-direction:column;gap:.25rem;background:#0c1019;border-radius:10px;padding:.9rem 1rem}
  .col h3{margin:0 0 .3rem;font-size:.7rem;color:#a78bfa;text-transform:uppercase;letter-spacing:.06em}
  .col b{font-size:1.05rem}
  .col span{font-size:.83rem;color:#c2cad7}
  .dim{color:#9aa6b8 !important;font-size:.78rem !important}
  .amount-reveal{margin-top:.9rem;font-size:1rem;display:flex;gap:.8rem;align-items:baseline}
  footer{margin-top:2rem;text-align:center;color:#6b7488;font-size:.75rem;line-height:1.5}
</style>

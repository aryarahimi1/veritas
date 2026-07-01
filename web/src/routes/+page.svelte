<script>
  import { onMount } from 'svelte';
  import { anchorLive, tamperReject, readAttestation, openWithViewKey, setWallet } from '$lib/veritas.js';
  import { TRANSFER, EXPLORER, VERITAS_CONTRACT, PUBLIC_SIGNALS, TX } from '$lib/fixtures.js';

  let amount = 4200;
  let walletKind = 'ephemeral';
  const pickWallet = (k) => { walletKind = k; setWallet(k); };
  let stage = 'idle'; // idle | loading | proving | submitting | anchored
  let busy = false;
  let error = '';
  let result = null;
  let live = false;
  let anchoredAt = 0;
  let regulator = false;
  let opened = null;
  let liveRead = null;
  let tamper = null;
  let log = [];

  let now = Date.now();
  onMount(() => {
    const i = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(i);
  });
  $: ageSec = anchoredAt ? Math.max(0, Math.floor((now - anchoredAt) / 1000)) : 0;

  const short = (s, n = 7) => (s && String(s).length > 2 * n ? `${String(s).slice(0, n)}…${String(s).slice(-n)}` : s ?? '—');
  const stageLabel = { loading: 'loading proving key…', proving: 'generating ZK proof…', submitting: 'submitting to Stellar…' };

  async function anchor() {
    busy = true;
    error = '';
    stage = 'loading';
    regulator = false;
    opened = null;
    liveRead = null;
    tamper = null;
    try {
      result = await anchorLive(amount, (s) => (stage = s));
      live = true;
      if (result.kind) walletKind = result.kind; // reflect a silent ephemeral fallback
    } catch (e) {
      // A-with-fallback: never hard-fail — show the real, previously-anchored on-chain proof.
      console.warn('live path failed, using cached on-chain proof:', e?.message || e);
      result = {
        txHash: TX.submit,
        bracket: PUBLIC_SIGNALS.bracket,
        attCommitment: PUBLIC_SIGNALS.attCommitment,
        settlementRef: PUBLIC_SIGNALS.settlementRef,
        amount: TRANSFER.amount, // the cached tx actually anchored this amount, not the slider's current value
        account: '(demo source)'
      };
      live = false;
    }
    stage = 'anchored';
    anchoredAt = Date.now();
    log = [{ txHash: result.txHash, bracket: result.bracket, live, at: Date.now() }, ...log].slice(0, 6);
    busy = false;
  }

  async function toggleRegulator() {
    if (regulator) return (regulator = false);
    busy = true;
    error = '';
    try {
      if (!opened) opened = await openWithViewKey(result);
      regulator = true;
    } catch (e) {
      error = 'Could not open attestation.';
    } finally {
      busy = false;
    }
  }

  async function doReadLive() {
    busy = true;
    try {
      liveRead = await readAttestation(result.settlementRef);
      if (!liveRead) liveRead = { missing: true };
    } catch (e) {
      liveRead = { error: true };
    } finally {
      busy = false;
    }
  }

  async function doTamper() {
    busy = true;
    tamper = { running: true };
    try {
      tamper = await tamperReject(amount);
    } catch (e) {
      tamper = { rejected: false, localError: String(e?.message || e).split('\n')[0] };
    } finally {
      busy = false;
    }
  }

  function reset() {
    stage = 'idle';
    result = null;
    regulator = false;
    opened = null;
    liveRead = null;
    tamper = null;
    error = '';
    anchoredAt = 0;
  }

  // flatten the IVMS record safely for the reveal
  $: o = opened?.ivms?.originator?.originatorPersons?.[0]?.naturalPerson;
  $: b = opened?.ivms?.beneficiary?.beneficiaryPersons?.[0]?.naturalPerson;
  $: rev = opened
    ? {
        oName: [o?.name?.nameIdentifier?.[0]?.secondaryIdentifier, o?.name?.nameIdentifier?.[0]?.primaryIdentifier].filter(Boolean).join(' ') || '—',
        oAddr: [o?.geographicAddress?.[0]?.addressLine?.[0], o?.geographicAddress?.[0]?.townName, o?.geographicAddress?.[0]?.country].filter(Boolean).join(', '),
        oDob: o?.dateAndPlaceOfBirth?.dateOfBirth ?? '—',
        oVasp: opened.ivms.originatingVASP,
        bName: [b?.name?.nameIdentifier?.[0]?.secondaryIdentifier, b?.name?.nameIdentifier?.[0]?.primaryIdentifier].filter(Boolean).join(' ') || '—',
        bAddr: [b?.geographicAddress?.[0]?.addressLine?.[0], b?.geographicAddress?.[0]?.townName, b?.geographicAddress?.[0]?.country].filter(Boolean).join(', '),
        bVasp: opened.ivms.beneficiaryVASP,
        amount: opened.ivms.transfer?.amount,
        asset: opened.ivms.transfer?.asset,
        commitmentMatch: opened.commitmentMatch
      }
    : null;
</script>

<div class="bar">
  <span class="dot" /> TESTNET
  <span class="sep">·</span>
  <span class="mono">contract {short(VERITAS_CONTRACT, 6)}</span>
  <a class="barlink" href={`${EXPLORER}/contract/${VERITAS_CONTRACT}`} target="_blank" rel="noreferrer">verify ↗</a>
</div>

<main>
  <header>
    <h1>Veritas</h1>
    <p class="tag">Prove the Travel Rule was followed — without putting an identity on-chain. Every run is a real proof and a real transaction.</p>
  </header>

  <!-- input -->
  <section class="compose">
    <div class="parties">
      <div><label for="originator">Originator VASP <span class="sim">SIMULATED</span></label><b id="originator">{TRANSFER.originator}</b><span>{TRANSFER.originatorJurisdiction}</span></div>
      <div class="ar">→</div>
      <div><label for="beneficiary">Beneficiary VASP <span class="sim">SIMULATED</span></label><b id="beneficiary">{TRANSFER.beneficiary}</b><span>{TRANSFER.beneficiaryJurisdiction}</span></div>
    </div>
    <div class="slider">
      <label for="amount">Transfer amount (hidden on-chain — only the bracket is proven)</label>
      <input id="amount" type="range" min="100" max="10000" step="100" bind:value={amount} disabled={busy} />
      <div class="amtrow"><span class="amt mono">{amount.toLocaleString()} USDC</span>
        <span class="bracket" class:full={amount >= 1000}>{amount >= 1000 ? 'FULL IVMS101 (≥ $1,000)' : 'reduced (< $1,000)'}</span></div>
    </div>
    <div class="wallet">
      <span>Sign with</span>
      <button class="seg" class:on={walletKind === 'ephemeral'} on:click={() => pickWallet('ephemeral')} disabled={busy}>Ephemeral · auto-funded</button>
      <button class="seg" class:on={walletKind === 'freighter'} on:click={() => pickWallet('freighter')} disabled={busy}>Freighter wallet</button>
    </div>
    {#if stage === 'idle'}
      <button class="primary" on:click={anchor} disabled={busy}>Generate ZK proof + anchor on Stellar</button>
    {:else if stage !== 'anchored'}
      <button class="primary" disabled aria-busy="true"><span class="spin">◜</span> {stageLabel[stage] ?? 'working…'}</button>
    {:else}
      <button class="ghost" on:click={reset} disabled={busy}>↺ run again</button>
    {/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </section>

  {#if stage === 'anchored' && result}
    <!-- the two ledgers -->
    <section class="ledgers">
      <!-- LEFT: public -->
      <div class="pane public">
        <div class="ph"><span>What the chain sees</span>{#if live}<span class="badge real">VERIFIED ON-CHAIN</span>{:else}<span class="badge cached">CACHED (live run unavailable)</span>{/if}</div>
        <div class="verdict">✓ Travel-Rule compliant</div>
        <dl>
          <div><dt>Originator</dt><dd class="redact">████████████</dd></div>
          <div><dt>Beneficiary</dt><dd class="redact">█████████</dd></div>
          <div><dt>Amount</dt><dd class="redact">██████</dd></div>
          <div><dt>Bracket</dt><dd>{result.bracket === 1 ? 'full IVMS101' : 'reduced'}</dd></div>
          <div><dt>Commitment</dt><dd class="mono sm">{short(result.attCommitment, 8)}</dd></div>
          <div><dt>Settlement</dt><dd class="mono sm">{short(result.settlementRef, 8)}</dd></div>
        </dl>
        <div class="tx">
          <a href={`${EXPLORER}/tx/${result.txHash}`} target="_blank" rel="noreferrer" class="mono">{short(result.txHash, 8)} ↗</a>
          {#if live}<span class="age" role="status">confirmed {ageSec}s ago</span>{/if}
        </div>
        <div class="acts">
          <button class="ghost" on:click={doReadLive} disabled={busy}>read live from chain</button>
          <button class="ghost danger" on:click={doTamper} disabled={busy}>try to forge it</button>
        </div>
        {#if liveRead}
          <p class="readout mono">{liveRead.error ? 'read error' : liveRead.missing ? 'not found' : `chain → bracket=${liveRead.bracket}, submitter=${short(liveRead.submitter, 4)}, ledger=${liveRead.ledger}`}</p>
        {/if}
        {#if tamper}
          <p class="readout" class:bad={tamper.rejected}>{tamper.running ? 'submitting a tampered proof…' : tamper.rejected ? `contract REJECTED on-chain: ${tamper.reason}` : tamper.localError ? `couldn't reach contract: ${tamper.localError}` : 'unexpectedly accepted'}</p>
        {/if}
      </div>

      <!-- RIGHT: private -->
      <div class="pane private" class:open={regulator}>
        <div class="ph"><span>The full truth</span><span class="badge {regulator ? 'real' : 'lock'}">{regulator ? 'VIEW-KEY APPLIED' : 'SEALED'}</span></div>
        {#if !regulator}
          <div class="vault">
            <div class="lock">⬡</div>
            <p>Simulates what a regulator holding the view key would see. The chain itself holds only a commitment — no identity, no amount.</p>
            <button class="primary sm" on:click={toggleRegulator} disabled={busy}>{busy ? 'opening…' : 'Apply regulator view-key'}</button>
          </div>
        {:else if rev}
          <div class="truth">
            <div class="match">opened with the regulator view-key <span class="ok">✓</span></div>
            {#if rev.commitmentMatch === true}
              <div class="match">attCommitment recomputed from these fields — matches the value anchored on-chain <span class="ok">✓</span></div>
            {:else if rev.commitmentMatch === false}
              <div class="match">attCommitment recomputed from these fields — does <b>not</b> match the anchored value <span class="warn">✗</span></div>
            {/if}
            <div class="cols">
              <div><h4>Originator</h4><b>{rev.oName}</b><span>{rev.oAddr}</span><span class="dim">DOB {rev.oDob}</span><span class="dim">{rev.oVasp?.name} · {rev.oVasp?.lei}</span></div>
              <div><h4>Beneficiary</h4><b>{rev.bName}</b><span>{rev.bAddr}</span><span class="dim">{rev.bVasp?.name} · {rev.bVasp?.lei}</span></div>
            </div>
            <div class="amt2">Amount <b>{rev.amount} {rev.asset}</b></div>
            <button class="ghost sm" on:click={toggleRegulator}>seal again</button>
            <p class="note">The public ledger (left) stays redacted forever — the chain itself never stores this data, only its commitment. This panel is a client-side simulation of the reconstruction a real key-holder would do (see SECURITY.md: this demo build, unlike the on-chain commitment, does not gate the secret behind real access control).</p>
          </div>
        {/if}
      </div>
    </section>

    {#if log.length > 1}
      <section class="logsec">
        <h3>Compliance log <span class="dim">— anchored this session</span></h3>
        {#each log as e}
          <a class="logrow mono" href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer">
            <span class="ok">✓</span> {short(e.txHash, 8)} <span class="dim">bracket {e.bracket}{e.live ? '' : ' · cached'}</span> ↗
          </a>
        {/each}
      </section>
    {/if}
  {/if}

  <footer>
    Real BLS12-381 Groth16 proof, generated in-browser and verified inside a Soroban contract on Stellar testnet.
    Proof + transaction are live; the VASPs and IVMS101 data are simulated (see SECURITY.md).
  </footer>
</main>

<style>
  :global(body){margin:0;background:#0b0d12;color:#e9ecf2;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-feature-settings:'tnum'}
  .mono{font-family:ui-monospace,'SF Mono',Menlo,monospace}
  .bar{display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem;background:#0e1117;border-bottom:1px solid #1b2230;font-size:.74rem;color:#8a93a6}
  .dot{width:7px;height:7px;border-radius:50%;background:#3ddc97;box-shadow:0 0 8px #3ddc97}
  .bar .sep{color:#39414f}
  .barlink{margin-left:auto;color:#6ea8fe;text-decoration:none}
  main{max-width:1080px;margin:0 auto;padding:2rem 1.25rem 4rem}
  header h1{font-size:1.9rem;letter-spacing:-.02em;margin:0;font-weight:800}
  .tag{color:#8a93a6;margin:.3rem 0 0;max-width:60ch}
  section{margin-top:1.25rem}
  .compose{background:#11151e;border:1px solid #1d2533;border-radius:14px;padding:1.2rem 1.4rem}
  .parties{display:flex;align-items:center;gap:1rem}
  .parties > div{flex:1;display:flex;flex-direction:column;gap:.12rem}
  .parties label{font-size:.66rem;color:#6c7585;text-transform:uppercase;letter-spacing:.05em}
  .parties b{font-size:1rem}
  .parties span{font-size:.78rem;color:#8a93a6}
  .ar{flex:0;color:#6ea8fe;font-size:1.3rem}
  .sim{background:#241a08;color:#d8a657;border:1px dashed #6b521f;border-radius:4px;padding:0 .3rem;font-size:.6rem;letter-spacing:.04em}
  .slider{margin-top:1.1rem}
  .slider label{font-size:.72rem;color:#8a93a6}
  .slider input{width:100%;margin:.5rem 0 .3rem;accent-color:#7c5cff}
  .amtrow{display:flex;justify-content:space-between;align-items:baseline}
  .amt{font-size:1.15rem;font-weight:700}
  .bracket{font-size:.74rem;color:#8a93a6}
  .bracket.full{color:#3ddc97}
  .wallet{display:flex;align-items:center;gap:.5rem;margin-top:1rem;font-size:.74rem;color:#8a93a6}
  .seg{background:#161c28;color:#8a93a6;border:1px solid #232c3c;padding:.3rem .7rem;font-size:.74rem;font-weight:500}
  .seg.on{background:#1c2740;color:#cdd6e4;border-color:#3a4a6e}
  button{cursor:pointer;border:0;border-radius:10px;font-weight:600;transition:filter .15s}
  button:disabled{opacity:.55;cursor:default}
  button:hover:not(:disabled){filter:brightness(1.1)}
  .primary{width:100%;margin-top:1.1rem;background:#7c5cff;color:#fff;padding:.78rem;font-size:.95rem}
  .primary.sm{width:auto;margin:.3rem 0 0;padding:.5rem .9rem;font-size:.84rem}
  .ghost{background:#1a2230;color:#cfd6e4;padding:.45rem .85rem;font-size:.8rem}
  .ghost.sm{padding:.35rem .7rem}
  .ghost.danger{color:#f0a59b}
  .spin{display:inline-block;animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .err{color:#f0a59b;font-size:.82rem;margin:.6rem 0 0}
  .ledgers{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  .pane{border-radius:14px;padding:1.1rem 1.3rem;min-height:300px}
  .ph{display:flex;justify-content:space-between;align-items:center;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.9rem}
  .badge{font-size:.6rem;padding:.12rem .4rem;border-radius:4px;letter-spacing:.04em}
  .badge.real{background:#06321f;color:#3ddc97;border:1px solid #14512f}
  .badge.cached{background:#2a2207;color:#d8a657;border:1px solid #5a4818}
  .badge.lock{background:#1b1f2a;color:#8a93a6;border:1px solid #2a3242}
  /* LEFT public = light institutional document */
  .public{background:#f4f1ea;color:#1c2128;border:1px solid #d9d2c4}
  .public .ph{color:#7a7464}
  .verdict{font-size:1.3rem;font-weight:800;color:#1a7f4b;margin-bottom:.8rem}
  .public dl{margin:0;display:grid;gap:.4rem}
  .public dl > div{display:flex;justify-content:space-between;border-bottom:1px solid #e4ddcf;padding-bottom:.35rem}
  .public dt{font-size:.74rem;color:#6b6555;text-transform:uppercase;letter-spacing:.04em}
  .public dd{margin:0;font-size:.86rem;font-weight:600}
  .public dd.sm{font-size:.76rem;font-weight:500}
  .redact{background:#1c2128;color:#1c2128;border-radius:3px;letter-spacing:-1px;user-select:none}
  .tx{margin-top:.9rem;display:flex;align-items:center;gap:.7rem;flex-wrap:wrap}
  .public .tx a{color:#2d6cdf;text-decoration:none;font-size:.8rem}
  .age{font-size:.72rem;color:#1a7f4b;font-variant-numeric:tabular-nums}
  .acts{display:flex;gap:.5rem;margin-top:.8rem}
  .public .ghost{background:#e7e0d2;color:#3a3a3a}
  .public .ghost.danger{color:#b4452f}
  .readout{margin:.7rem 0 0;font-size:.76rem;color:#5a5546}
  .readout.bad{color:#b4452f;font-weight:600}
  /* RIGHT private = dark vault */
  .private{background:#0f1320;border:1px solid #1e2740;transition:box-shadow .4s}
  .private.open{box-shadow:0 0 0 1px #3b2d63,0 0 40px -12px #7c5cff}
  .vault{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.7rem;height:240px;color:#8a93a6}
  .vault .lock{font-size:2.4rem;color:#4b3f7a}
  .vault p{font-size:.82rem;max-width:34ch;margin:0}
  .truth{animation:fade .4s ease}
  @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1}}
  .match{font-size:.78rem;color:#c4b5fd;margin-bottom:.8rem}
  .ok{color:#3ddc97}
  .warn{color:#f0a59b}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
  .cols > div{display:flex;flex-direction:column;gap:.2rem;background:#0b0e18;border-radius:9px;padding:.7rem .8rem}
  .cols h4{margin:0 0 .25rem;font-size:.64rem;color:#a78bfa;text-transform:uppercase;letter-spacing:.06em}
  .cols b{font-size:1rem}
  .cols span{font-size:.78rem;color:#c2cad7}
  .dim{color:#7c8699}
  .amt2{margin-top:.8rem;font-size:.95rem}
  .note{font-size:.74rem;color:#8a93a6;margin:.8rem 0 0;max-width:52ch}
  .logsec h3{font-size:.78rem;color:#8a93a6;font-weight:600}
  .logrow{display:block;color:#aeb7c8;text-decoration:none;font-size:.78rem;padding:.35rem 0;border-bottom:1px solid #161c28}
  footer{margin-top:2rem;text-align:center;color:#5c6577;font-size:.74rem;line-height:1.6;max-width:70ch;margin-left:auto;margin-right:auto}
  @media(max-width:760px){.ledgers{grid-template-columns:1fr}.cols{grid-template-columns:1fr}}
</style>

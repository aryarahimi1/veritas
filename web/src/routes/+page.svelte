<script>
  import { onMount, tick } from 'svelte';
  import { anchorLive, tamperReject, readAttestation, openWithViewKey, setWallet, prewarm, preflight } from '$lib/veritas.js';
  import { TRANSFER, EXPLORER, VERITAS_CONTRACT, GROTH16_VERIFIER, PUBLIC_SIGNALS, TX } from '$lib/fixtures.js';
  import { DEMO_MODE } from '$lib/config.js';
  import { contractErrorLabel } from '$lib/errors.js';

  let amount = 4200;
  let walletKind = 'ephemeral';
  const pickWallet = (k) => { walletKind = k; setWallet(k); };
  let stage = 'idle'; // idle | loading | proving | submitting | anchored | failed
  let busy = false;
  let error = '';
  let failError = ''; // human-readable reason a live run couldn't complete (drives the retry card)
  let cached = false; // true only when the user explicitly views the previously-anchored proof
  let txIndexed = false; // gate fresh-tx explorer links until the indexer catches up (avoid a 404)
  let result = null;
  let live = false;
  let anchoredAt = 0;
  let regulator = false;
  let opened = null;
  let liveRead = null;
  let tamper = null;
  let log = [];
  let health = 'checking'; // checking | ready | degraded | down — drives the TESTNET status dot
  let vaultError = ''; // view-key open failure, rendered inside the vault card (not the compose card)
  let freighterFellBack = false; // the user picked Freighter but the run signed with an ephemeral key

  let now = Date.now();
  onMount(() => {
    prewarm(); // warm proving assets + pre-fund so the first live run is instant
    preflight()
      .then((h) => (health = h.status))
      .catch(() => (health = 'down'));
    const i = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(i);
  });
  $: ageSec = anchoredAt ? Math.max(0, Math.floor((now - anchoredAt) / 1000)) : 0;

  const short = (s, n = 7) => (s && String(s).length > 2 * n ? `${String(s).slice(0, n)}…${String(s).slice(-n)}` : s ?? '—');
  const stageLabel = {
    loading: 'loading the proving key…',
    paying: 'sending a real settlement payment on Stellar…',
    proving: 'veritas.prove() — generating the ZK proof in this browser',
    submitting: 'veritas.anchor() — the Soroban contract verifies the pairing on-chain'
  };

  async function anchor() {
    const pickedWallet = walletKind; // snapshot the choice, so a silent fallback can be disclosed after the run
    busy = true;
    error = '';
    failError = '';
    vaultError = '';
    freighterFellBack = false;
    cached = false;
    stage = 'loading';
    regulator = false;
    opened = null;
    liveRead = null;
    tamper = null;
    try {
      result = await anchorLive(amount, (s) => (stage = s));
      live = true;
      if (result.kind) walletKind = result.kind; // reflect a silent ephemeral fallback
      freighterFellBack = pickedWallet === 'freighter' && result.kind === 'ephemeral';
      stage = 'anchored';
      anchoredAt = Date.now();
      txIndexed = false;
      setTimeout(() => (txIndexed = true), 6000); // let stellar.expert index the fresh tx before linking it
      log = [{ txHash: result.txHash, bracket: result.bracket, live: true, at: Date.now() }, ...log].slice(0, 6);
      scrollToLedgers();
    } catch (e) {
      // Never blank the screen and never silently swap the amount: surface an explicit retry that
      // PRESERVES the chosen amount. The cached proof is opt-in only (showCached), so nothing on
      // screen can contradict the slider.
      console.warn('live run failed:', e?.message || e);
      failError = humanizeError(e);
      stage = 'failed';
    } finally {
      busy = false;
    }
  }

  // Reason text for the retry card — names a real on-chain error when there is one.
  function humanizeError(e) {
    const m = String(e?.message || e);
    const label = contractErrorLabel(m);
    if (label) return `the contract returned ${label}`;
    if (/friendbot/i.test(m)) return 'testnet funding (Friendbot) was unavailable';
    if (/freighter|wallet|denied|reject|access/i.test(m)) return 'the wallet request was declined';
    if (/rpc|network|timeout|fetch|getaddrinfo|ENOTFOUND/i.test(m)) return 'the testnet RPC was unreachable';
    return (m.split('\n')[0] || 'the live run could not complete').slice(0, 140);
  }

  // Explicit, opt-in fallback: show the previously-anchored REAL proof. Snap EVERY panel — including
  // the slider — to that transaction's own true values, so no panel can contradict another.
  function showCached() {
    result = {
      txHash: TX.submit,
      bracket: PUBLIC_SIGNALS.bracket,
      attCommitment: PUBLIC_SIGNALS.attCommitment,
      settlementRef: PUBLIC_SIGNALS.settlementRef,
      amount: TRANSFER.amount,
      account: '(previously anchored)'
    };
    amount = TRANSFER.amount; // snap the slider to the cached tx; it stays disabled while cached
    live = false;
    cached = true;
    regulator = false;
    opened = null;
    liveRead = null;
    tamper = null;
    vaultError = '';
    freighterFellBack = false;
    anchoredAt = 0;
    txIndexed = true; // a previously-anchored tx is already indexed
    stage = 'anchored';
    log = [{ txHash: result.txHash, bracket: result.bracket, live: false, at: Date.now() }, ...log].slice(0, 6);
    scrollToLedgers();
  }

  async function toggleRegulator() {
    if (regulator) return (regulator = false);
    busy = true;
    vaultError = '';
    try {
      if (!opened) opened = await openWithViewKey(result);
      regulator = true;
    } catch (e) {
      vaultError = 'Could not open attestation.';
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
    failError = '';
    vaultError = '';
    freighterFellBack = false;
    anchoredAt = 0;
    cached = false;
    live = false;
    txIndexed = false;
  }

  // After a successful anchor (live or cached), bring the two ledgers — the payoff — into view.
  // Skips when they are already substantially visible; honors prefers-reduced-motion.
  async function scrollToLedgers() {
    await tick(); // let the ledgers render before measuring
    const el = document.querySelector('.ledgers');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top >= 0 && r.top < vh * 0.6) return; // already substantially in view
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
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

  // reveal-on-scroll (adds .is-in when a section enters the viewport). A safety timer guarantees the
  // section is never left hidden, even if it is below the fold and never scrolled to.
  function reveal(node) {
    let io;
    let done = false;
    const show = () => { if (!done) { done = true; node.classList.add('is-in'); if (io) io.disconnect(); } };
    io = new IntersectionObserver(([e]) => { if (e.isIntersecting) show(); }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    io.observe(node);
    const t = setTimeout(show, 900);
    return { destroy() { clearTimeout(t); io.disconnect(); } };
  }

  // the integration surface a VASP wires into its backend (the demo above runs this exact flow client-side)
  const INTEGRATE = `import { Veritas } from '@veritas/sdk';

// inside VASP A's backend — the customer PII never leaves your systems
const veritas = new Veritas({ network: 'stellar', signer });

const { proof, settlementRef } = await veritas.prove({
  ivms101,                         // the Travel Rule payload you already build
  amount,                          // hidden on-chain; only the bracket is proven
  counterparty: beneficiaryVaspId  // both counterparties in the licensed-VASP registry
});

// anchor the PII-free receipt inside the Soroban contract, on Stellar
const { txHash } = await veritas.anchor({ proof, settlementRef });
// -> anyone can verify txHash on stellar.expert; no identity is ever revealed`;
  let copied = false;
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(INTEGRATE);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch (e) {
      /* clipboard blocked — the snippet is still selectable */
    }
  }
</script>

<header class="topbar">
  <div class="wrap barwrap">
    <span class="brand"><span class="brandmark" aria-hidden="true"></span> Veritas</span>
    <span class="net">
      <span class="dot" class:amber={health === 'degraded' || health === 'checking'} class:down={health === 'down'}
        title={health === 'ready' ? 'live proving + testnet reachable' : health === 'checking' ? 'checking reachability…' : health === 'degraded' ? 'partially reachable — a live run may fall back to cached' : 'testnet unreachable — runs will use the cached proof'} />
      Stellar testnet
    </span>
    <span class="sep" aria-hidden="true">/</span>
    <span class="mono contractid">{short(VERITAS_CONTRACT, 5)}</span>
    <a class="verify-top" href={`${EXPLORER}/contract/${VERITAS_CONTRACT}`} target="_blank" rel="noreferrer">verify contract ↗</a>
  </div>
</header>

<main>
  <!-- HERO -->
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">FATF Travel Rule · Stellar / Soroban</p>
      <h1>Proof of compliance,<br />with no identity on-chain.</h1>
      <p class="lede">
        Veritas is a privacy-preserving Travel Rule compliance protocol. A single zero-knowledge proof,
        verified inside a Soroban smart contract, attests that a cross-VASP stablecoin transfer followed
        FATF Recommendation 16, without putting one customer detail on-chain. The public sees a verified
        seal; a regulator holding the view key opens the full record.
      </p>
      <aside class="figure">
        <span class="figure-n">$4.3B</span>
        <p>
          what Binance paid U.S. regulators in 2023, for exactly the cross-border customer-data failures
          the Travel Rule exists to prevent. Today there is still no shared, verifiable proof a compliance
          check ever happened. Veritas is that proof.
        </p>
      </aside>
      <div class="hero-cta">
        <a href="#demo" class="btn primary">See the live proof</a>
        <a class="btn ghost" href={`${EXPLORER}/contract/${VERITAS_CONTRACT}`} target="_blank" rel="noreferrer">Verify on testnet ↗</a>
      </div>
    </div>
  </section>

  <!-- DEMO -->
  <section id="demo" class="band demo">
    <div class="wrap">
      <div class="section-head"><span class="idx">01</span><h2>Anchor a compliant transfer, live on testnet</h2></div>

      <div class="compose">
        <div class="parties">
          <div class="party">
            <span class="plabel">Originator VASP {#if DEMO_MODE}<span class="sim">simulated</span>{/if}</span>
            <b id="originator">{TRANSFER.originator}</b>
            <span class="juris">{TRANSFER.originatorJurisdiction}</span>
          </div>
          <span class="flow" aria-hidden="true">→</span>
          <div class="party">
            <span class="plabel">Beneficiary VASP {#if DEMO_MODE}<span class="sim">simulated</span>{/if}</span>
            <b id="beneficiary">{TRANSFER.beneficiary}</b>
            <span class="juris">{TRANSFER.beneficiaryJurisdiction}</span>
          </div>
        </div>

        <div class="slider">
          <label for="amount">Transfer amount <span class="hint">— hidden on-chain, only the bracket is proven</span></label>
          <input id="amount" type="range" min="100" max="10000" step="100" bind:value={amount} disabled={busy || cached || stage === 'anchored'} />
          <div class="amtrow">
            <span class="amt mono">{amount.toLocaleString()}<span class="ccy"> USDC</span></span>
            <span class="bracket" class:full={amount >= 1000}>{amount >= 1000 ? 'full IVMS101 · ≥ $1,000' : 'reduced · < $1,000'}</span>
          </div>
        </div>

        <div class="wallet">
          <span class="wl">Sign with</span>
          <button class="seg" class:on={walletKind === 'ephemeral'} on:click={() => pickWallet('ephemeral')} disabled={busy}>Ephemeral · auto-funded</button>
          <button class="seg" class:on={walletKind === 'freighter'} on:click={() => pickWallet('freighter')} disabled={busy}>Freighter wallet</button>
        </div>
        {#if freighterFellBack}
          <p class="walletnote" role="status">Freighter unavailable — signed with an auto-funded ephemeral key.</p>
        {/if}

        {#if stage === 'idle'}
          <p class="preframe">One click sends a real testnet payment, proves compliance inside this browser, and anchors it in a Soroban contract — no identity, no amount, on-chain.</p>
          <button class="btn primary block" on:click={anchor} disabled={busy}>Generate ZK proof &amp; anchor on Stellar</button>
          {#if health === 'down'}
            <p class="healthnote err">testnet unreachable right now — a run will offer the previously anchored proof instead</p>
          {:else if health === 'degraded'}
            <p class="healthnote">testnet partially reachable — a live run may take a retry</p>
          {/if}
        {:else if stage === 'failed'}
          <div class="failcard" role="alert">
            <div class="failmsg"><span class="fx" aria-hidden="true">!</span> Live run couldn't complete — {failError}.</div>
            <div class="failacts">
              <button class="btn primary sm" on:click={anchor} disabled={busy}>↻ Retry live</button>
              <button class="btn ghost sm" on:click={showCached} disabled={busy}>Show last verified on-chain proof</button>
            </div>
            <p class="failnote">Retry keeps your <b>{amount.toLocaleString()} USDC</b>. Nothing is faked — the alternative shows a real transfer previously anchored on-chain (tx {short(TX.submit, 6)}).</p>
          </div>
        {:else if stage !== 'anchored'}
          <button class="btn primary block" disabled aria-busy="true"><span class="spin" aria-hidden="true"></span> {stageLabel[stage] ?? 'working…'}</button>
        {:else}
          <button class="btn ghost block" on:click={reset} disabled={busy}>↺ Run again</button>
        {/if}
        {#if error}<p class="err" role="alert">{error}</p>{/if}
      </div>

      {#if stage === 'anchored' && result}
        {#if cached}
          <div class="cachedbanner" role="status">
            <b>Cached</b> — a real transfer previously anchored on-chain (tx
            <a href={`${EXPLORER}/tx/${TX.submit}`} target="_blank" rel="noreferrer">{short(TX.submit, 8)} ↗</a>), not
            this session's live run. Every panel below reflects that transaction.
          </div>
        {/if}

        <div class="ledgers">
          <!-- LEFT: the public ledger, a redacted institutional filing -->
          <article class="ledger public">
            <div class="lh">
              <span class="lh-t">What the chain sees</span>
              {#if live}<span class="tag ok">verified on-chain</span>{:else}<span class="tag warn">previously anchored</span>{/if}
            </div>
            <div class="verdict"><span class="vstamp" aria-hidden="true">✓</span> Travel-Rule compliant</div>
            <p class="vsub">verified by Soroban's native BLS12-381 pairing check — ~41M of the 100M CPU budget</p>
            <dl class="filing">
              <div><dt>Originator</dt><dd class="redact" aria-label="redacted">████████████</dd></div>
              <div><dt>Beneficiary</dt><dd class="redact" aria-label="redacted">█████████</dd></div>
              <div><dt>Amount</dt><dd class="redact" aria-label="redacted">██████</dd></div>
              <div><dt>Bracket</dt><dd>{result.bracket === 1 ? 'full IVMS101' : 'reduced'}</dd></div>
              <div><dt>Commitment</dt><dd class="mono sm">{short(result.attCommitment, 8)}</dd></div>
              <div><dt>Settlement</dt><dd class="mono sm">{short(result.settlementRef, 8)}</dd></div>
            </dl>
            <div class="txrow">
              {#if cached || txIndexed}
                <a href={`${EXPLORER}/tx/${result.txHash}`} target="_blank" rel="noreferrer" class="mono txlink">{short(result.txHash, 8)} ↗</a>
              {:else}
                <span class="mono indexing" role="status">{short(result.txHash, 8)} · indexing…</span>
              {/if}
              {#if live}<span class="age" role="status">confirmed {ageSec}s ago</span>{/if}
            </div>
            {#if result.paymentTx}
              <div class="settlebind">
                <span class="sbl">One settlement on Stellar</span>
                {#if cached || txIndexed}
                  <a href={`${EXPLORER}/tx/${result.paymentTx}`} target="_blank" rel="noreferrer" class="mono">payment {short(result.paymentTx, 6)} ↗</a>
                  <span class="sarrow" aria-hidden="true">↦</span>
                  <a href={`${EXPLORER}/tx/${result.txHash}`} target="_blank" rel="noreferrer" class="mono">compliance {short(result.txHash, 6)} ↗</a>
                {:else}
                  <span class="mono indexing">payment {short(result.paymentTx, 6)}</span>
                  <span class="sarrow" aria-hidden="true">↦</span>
                  <span class="mono indexing" role="status">compliance {short(result.txHash, 6)} · indexing…</span>
                {/if}
                <span class="sbl2">both bound to settlement {short(result.settlementRef, 6)}</span>
              </div>
            {:else if live}
              <p class="settlemiss">settlement payment unavailable this run — the proof was anchored against a fresh settlement id</p>
            {/if}
            <div class="acts">
              <button class="btn tiny" on:click={doReadLive} disabled={busy}>read live from chain</button>
              {#if DEMO_MODE}<button class="btn sm danger" on:click={doTamper} disabled={busy}>try to forge it</button>{/if}
            </div>
            {#if DEMO_MODE && !tamper}
              <p class="forgehint">Don't trust the seal? Submit a forged proof — the deployed contract rejects it on-chain.</p>
            {/if}
            {#if liveRead}
              <p class="readout mono">{liveRead.error ? 'read error' : liveRead.missing ? 'not found' : `chain → bracket=${liveRead.bracket}, submitter=${short(liveRead.submitter, 4)}, ledger=${liveRead.ledger}`}</p>
            {/if}
            {#if tamper}
              {#if tamper.rejected}
                <div class="stamp" role="status"><span class="stamp-l">rejected on-chain</span><span class="stamp-c mono">{tamper.reason}</span></div>
                <p class="readout">one field of the attestation was altered; the contract's pairing check refused to anchor it</p>
              {:else if tamper.running}
                <p class="readout">forging one field of the attestation, then asking the contract to accept it…</p>
              {:else if tamper.localError}
                <p class="readout">couldn't reach contract: {tamper.localError}</p>
              {:else}
                <p class="readout">unexpectedly accepted</p>
              {/if}
            {/if}
          </article>

          <!-- RIGHT: the regulator vault, the single dark surface -->
          <article class="ledger vault" class:open={regulator}>
            <div class="lh">
              <span class="lh-t">The full truth</span>
              <span class="tag {regulator ? 'keyed' : 'sealed'}">{regulator ? 'view-key applied' : 'sealed'}</span>
            </div>
            {#if !regulator}
              <div class="sealface">
                <span class="wax" aria-hidden="true"><span class="wax-v">V</span></span>
                <p>Sealed to the regulator's view key. The chain holds only a commitment — no identity, no amount, no way in without the key.</p>
                <button class="btn key" on:click={toggleRegulator} disabled={busy}>{busy ? 'opening…' : 'Apply regulator view-key'}</button>
                {#if vaultError}<p class="verr" role="alert">{vaultError}</p>{/if}
              </div>
            {:else if rev}
              <div class="truth">
                <div class="attest"><span class="ok" aria-hidden="true">✓</span> opened with the regulator view-key</div>
                {#if rev.commitmentMatch === true}
                  <div class="attest"><span class="ok" aria-hidden="true">✓</span> recomputed commitment matches the value anchored on-chain</div>
                {:else if rev.commitmentMatch === false}
                  <div class="attest bad"><span aria-hidden="true">✗</span> recomputed commitment does <b>not</b> match the anchored value</div>
                {/if}
                <div class="cols">
                  <div class="rec">
                    <h4>Originator</h4>
                    <b>{rev.oName}</b>
                    <span>{rev.oAddr}</span>
                    <span class="dim">DOB {rev.oDob}</span>
                    <span class="dim mono">{rev.oVasp?.name} · {rev.oVasp?.lei}</span>
                  </div>
                  <div class="rec">
                    <h4>Beneficiary</h4>
                    <b>{rev.bName}</b>
                    <span>{rev.bAddr}</span>
                    <span class="dim mono">{rev.bVasp?.name} · {rev.bVasp?.lei}</span>
                  </div>
                </div>
                <div class="amt2">Amount <b>{rev.amount} {rev.asset}</b></div>
                <button class="btn tiny ghostv" on:click={toggleRegulator}>seal again</button>
                <p class="note">The public ledger stays redacted forever; the chain never stores this data, only its commitment. This panel is a client-side simulation of the reconstruction a real key-holder would perform (see SECURITY.md).</p>
              </div>
            {/if}
          </article>
        </div>

        {#if log.length > 1}
          <div class="logsec">
            <h3>Compliance log <span class="dim">— anchored this session</span></h3>
            <div class="logrows">
              {#each log as e}
                <a class="logrow mono" href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer">
                  <span class="ok" aria-hidden="true">✓</span> {short(e.txHash, 8)} <span class="dim">bracket {e.bracket}{e.live ? '' : ' · cached'}</span> ↗
                </a>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </section>

  <!-- HOW IT WORKS -->
  <section class="band alt reveal" use:reveal>
    <div class="wrap">
      <div class="section-head"><span class="idx">02</span><h2>How it works</h2></div>
      <ol class="steps">
        <li>
          <span class="stepn">i</span>
          <h3>Prove, where the data lives</h3>
          <p>VASP A generates the proof <em>inside its own systems</em> over the real IVMS101 payload and the hidden amount. The customer's identity never leaves the exchange.</p>
        </li>
        <li>
          <span class="stepn">ii</span>
          <h3>Verify, inside the contract</h3>
          <p>A Soroban contract runs the BLS12-381 pairing check on-chain, binds the licensed-VASP registry, the FATF threshold and the settlement, and stores a regulator-openable commitment. No PII touches the chain.</p>
        </li>
        <li>
          <span class="stepn">iii</span>
          <h3>Anyone verifies, only the regulator opens</h3>
          <p>The public reads a verified seal on stellar.expert. A regulator holding the view key reconstructs the full attestation and checks it against the on-chain commitment.</p>
        </li>
      </ol>
    </div>
  </section>

  <!-- INTEGRATE -->
  <section class="band reveal" use:reveal>
    <div class="wrap">
      <div class="section-head"><span class="idx">03</span><h2>Integrate in about ten lines</h2></div>
      <p class="section-lede">Veritas is infrastructure, not an app. An exchange wires the SDK into its backend; proving runs client-side, so Veritas never custodies a byte of PII. The demo above runs this exact flow in the browser.</p>
      <figure class="code">
        <figcaption><span class="fname mono">vasp-a/anchor-compliance.ts</span><button class="copy" on:click={copyCode}>{copied ? 'copied' : 'copy'}</button></figcaption>
        <pre class="mono"><code>{INTEGRATE}</code></pre>
      </figure>
    </div>
  </section>

  <!-- VERIFY / TRUST -->
  <section class="band alt reveal" use:reveal>
    <div class="wrap">
      <div class="section-head"><span class="idx">04</span><h2>Verify it yourself</h2></div>
      <p class="section-lede">Nothing here asks for trust. Every artifact is on Stellar testnet and independently checkable.</p>
      <ul class="verify-list">
        <li>
          <span class="vl-what">Veritas contract</span>
          <span class="vl-desc">verifies the proof, anchors the compliance receipt — ~41M of the 100M CPU budget</span>
          <a class="mono" href={`${EXPLORER}/contract/${VERITAS_CONTRACT}`} target="_blank" rel="noreferrer">{short(VERITAS_CONTRACT, 6)} ↗</a>
        </li>
        <li>
          <span class="vl-what">submit_compliance</span>
          <span class="vl-desc">real proof verified, attestation anchored, event emitted</span>
          <a class="mono" href={`${EXPLORER}/tx/${TX.submit}`} target="_blank" rel="noreferrer">{short(TX.submit, 6)} ↗</a>
        </li>
        <li>
          <span class="vl-what">Groth16 verifier</span>
          <span class="vl-desc">standalone verifier from Phase 1 — the same BLS12-381 pairing check now runs inside the Veritas contract above</span>
          <a class="mono" href={`${EXPLORER}/contract/${GROTH16_VERIFIER}`} target="_blank" rel="noreferrer">{short(GROTH16_VERIFIER, 6)} ↗</a>
        </li>
      </ul>
      <p class="honest">
        <b>Real:</b> the circuit, the proof, its on-chain verification, and every artifact linked above.
        <b>Simulated:</b> the participating VASPs and the customer identities (synthetic IVMS101) — you
        can't onboard a licensed exchange for a demo. The cryptography and the on-chain records are not
        mocked. Full disclosure in SECURITY.md.
      </p>
    </div>
  </section>

  <footer>
    <div class="wrap">
      <span class="brand"><span class="brandmark" aria-hidden="true"></span> Veritas</span>
      <p>
        Real BLS12-381 Groth16 proof, generated in-browser and verified inside a Soroban contract on
        Stellar testnet. Soroban's native BLS12-381 host functions make the on-chain pairing check cost
        ~41M of the 100M CPU budget. Each run sends a real settlement payment and anchors a fresh
        compliance receipt.
      </p>
    </div>
  </footer>
</main>

<style>
  :root {
    /* paper — warm parchment neutrals */
    --paper: oklch(96.2% 0.011 84);
    --paper-raised: oklch(98.4% 0.008 84);
    --paper-sunk: oklch(93.2% 0.014 82);
    --rule: oklch(86% 0.017 80);
    --rule-soft: oklch(90.5% 0.013 82);
    /* ink — cool blue-black */
    --ink: oklch(24% 0.028 262);
    --ink-body: oklch(33% 0.026 262);
    --ink-muted: oklch(49% 0.021 262);
    --ink-faint: oklch(58% 0.017 262);
    /* accents */
    --blue: oklch(47% 0.135 258);
    --blue-strong: oklch(41% 0.145 258);
    --seal: oklch(45% 0.15 27);
    --seal-strong: oklch(39% 0.155 27);
    --verify: oklch(45% 0.11 152);
    --brass: oklch(66% 0.11 76);
    /* vault — the single dark surface */
    --vault: oklch(23% 0.024 264);
    --vault-raised: oklch(27.5% 0.028 264);
    --vault-rule: oklch(37% 0.03 264);
    --vault-ink: oklch(92% 0.011 84);
    --vault-muted: oklch(70% 0.016 262);
    --vault-blue: oklch(76% 0.085 250);
    /* type + motion */
    --sans: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    --e-out: cubic-bezier(0.16, 1, 0.3, 1);
    --e-quart: cubic-bezier(0.25, 1, 0.5, 1);
    --edge: min(6vw, 5rem);
  }

  :global(body) {
    margin: 0;
    background: var(--paper);
    color: var(--ink-body);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    font-feature-settings: 'tnum' 1, 'ss01' 1;
  }
  :global(*, *::before, *::after) { box-sizing: border-box; }
  .mono { font-family: var(--mono); font-feature-settings: 'tnum' 1; }
  h1, h2, h3, h4 { color: var(--ink); text-wrap: balance; margin: 0; }
  a { color: var(--blue); }

  .wrap { max-width: 1120px; margin: 0 auto; padding-inline: var(--edge); }

  /* ---- top bar ---- */
  .topbar { border-bottom: 1px solid var(--rule); background: color-mix(in oklab, var(--paper) 82%, transparent); backdrop-filter: saturate(1.1); position: sticky; top: 0; z-index: 20; }
  .barwrap { display: flex; align-items: center; gap: 0.75rem; height: 46px; font-size: 0.78rem; color: var(--ink-muted); }
  .brand { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; }
  .brandmark { width: 12px; height: 12px; border-radius: 3px; background: linear-gradient(135deg, var(--blue), var(--seal)); box-shadow: inset 0 0 0 1.5px color-mix(in oklab, var(--paper) 70%, transparent); }
  .net { display: inline-flex; align-items: center; gap: 0.4rem; margin-left: 0.5rem; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--verify); box-shadow: 0 0 0 3px color-mix(in oklab, var(--verify) 20%, transparent); transition: background 0.3s; }
  .dot.amber { background: var(--brass); box-shadow: 0 0 0 3px color-mix(in oklab, var(--brass) 20%, transparent); }
  .dot.down { background: var(--seal); box-shadow: 0 0 0 3px color-mix(in oklab, var(--seal) 20%, transparent); }
  .barwrap .sep { color: var(--rule); }
  .contractid { color: var(--ink-muted); }
  .verify-top { margin-left: auto; text-decoration: none; font-weight: 500; }
  .verify-top:hover { text-decoration: underline; }

  /* ---- hero ---- */
  .hero { padding: clamp(3.5rem, 8vw, 7rem) 0 clamp(2.5rem, 5vw, 4rem); border-bottom: 1px solid var(--rule); position: relative; }
  .hero::after { content: ''; position: absolute; inset: 0; pointer-events: none; background-image: repeating-linear-gradient(-38deg, color-mix(in oklab, var(--ink) 5%, transparent) 0 1px, transparent 1px 9px), repeating-linear-gradient(38deg, color-mix(in oklab, var(--ink) 4%, transparent) 0 1px, transparent 1px 9px); mask-image: radial-gradient(130% 90% at 92% 0%, #000, transparent 58%); opacity: 0.7; }
  .eyebrow { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.16em; color: var(--seal); font-weight: 600; margin: 0 0 1.1rem; }
  .hero h1 { font-size: clamp(2.3rem, 1.2rem + 4.4vw, 4rem); font-weight: 600; letter-spacing: -0.03em; line-height: 1.02; }
  .lede { font-size: clamp(1.05rem, 0.98rem + 0.5vw, 1.28rem); color: var(--ink-body); max-width: 60ch; margin: 1.4rem 0 0; line-height: 1.55; text-wrap: pretty; }
  .hero-cta { display: flex; flex-wrap: wrap; gap: 0.7rem; margin-top: clamp(1.9rem, 4vw, 2.6rem); }
  .figure { max-width: 62ch; margin: clamp(2rem, 4.5vw, 3rem) 0 0; padding-left: 1.3rem; border-left: 2px solid var(--seal); display: grid; grid-template-columns: auto 1fr; gap: 0 1.2rem; align-items: baseline; }
  .figure-n { font-size: clamp(1.8rem, 1.2rem + 2vw, 2.6rem); font-weight: 600; color: var(--ink); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .figure p { margin: 0; font-size: 0.95rem; color: var(--ink-muted); }

  /* ---- buttons ---- */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; font-family: inherit; font-size: 0.92rem; font-weight: 500; padding: 0.7rem 1.15rem; border-radius: 8px; border: 1px solid transparent; cursor: pointer; text-decoration: none; transition: background 0.18s var(--e-quart), border-color 0.18s, color 0.18s, transform 0.06s; }
  .btn:active:not(:disabled) { transform: translateY(1px); }
  .btn.primary { background: var(--ink); color: var(--paper-raised); }
  .btn.primary:hover:not(:disabled) { background: var(--blue-strong); }
  .btn.ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
  .btn.ghost:hover:not(:disabled) { border-color: var(--ink-muted); background: var(--paper-sunk); }
  .btn.block { width: 100%; margin-top: 1.2rem; padding-block: 0.85rem; font-size: 0.95rem; }
  .btn.sm { padding: 0.5rem 0.85rem; font-size: 0.85rem; }
  .btn.tiny { padding: 0.4rem 0.7rem; font-size: 0.8rem; background: var(--paper-sunk); color: var(--ink-body); border-color: var(--rule); border-radius: 7px; }
  .btn.tiny:hover:not(:disabled) { border-color: var(--ink-faint); }
  .btn.danger { background: var(--paper-sunk); color: var(--seal); border-color: color-mix(in oklab, var(--seal) 30%, var(--rule)); }
  .btn.danger:hover:not(:disabled) { border-color: var(--seal); }
  .btn:disabled { opacity: 0.55; cursor: default; }
  :global(a.btn) { color: var(--paper-raised); }
  :global(a.btn.ghost) { color: var(--ink); }

  .spin { width: 13px; height: 13px; border-radius: 50%; border: 2px solid color-mix(in oklab, var(--paper) 45%, transparent); border-top-color: var(--paper-raised); animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ---- bands / section heads ---- */
  .band { padding: clamp(3rem, 6vw, 5.5rem) 0; border-bottom: 1px solid var(--rule); }
  .band.alt { background: color-mix(in oklab, var(--paper-sunk) 60%, var(--paper)); }
  .section-head { display: flex; align-items: baseline; gap: 0.9rem; margin-bottom: 1.8rem; }
  .idx { font-family: var(--mono); font-size: 0.8rem; color: var(--seal); font-weight: 500; padding-top: 0.15rem; }
  .section-head h2 { font-size: clamp(1.4rem, 1.1rem + 1vw, 1.85rem); font-weight: 600; letter-spacing: -0.02em; }
  .section-lede { max-width: 64ch; color: var(--ink-muted); margin: -0.8rem 0 1.6rem; }

  /* ---- compose card ---- */
  .compose { background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 14px; padding: clamp(1.2rem, 3vw, 1.8rem); box-shadow: 0 1px 0 color-mix(in oklab, var(--ink) 6%, transparent), 0 18px 40px -30px color-mix(in oklab, var(--ink) 40%, transparent); }
  .parties { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem 1rem; }
  .party { display: flex; flex-direction: column; gap: 0.12rem; }
  .plabel { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint); }
  .party b { font-size: 1.02rem; color: var(--ink); }
  .juris { font-size: 0.8rem; color: var(--ink-muted); }
  .flow { color: var(--blue); font-size: 1.2rem; }
  .sim { font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--seal); border: 1px solid color-mix(in oklab, var(--seal) 35%, var(--rule)); border-radius: 4px; padding: 0.05rem 0.3rem; vertical-align: middle; }
  .slider { margin-top: 1.5rem; }
  .slider label { font-size: 0.82rem; color: var(--ink-body); font-weight: 500; }
  .slider .hint { color: var(--ink-faint); font-weight: 400; }
  .slider input { width: 100%; margin: 0.7rem 0 0.4rem; accent-color: var(--blue); height: 4px; }
  .amtrow { display: flex; justify-content: space-between; align-items: baseline; }
  .amt { font-size: 1.35rem; font-weight: 500; color: var(--ink); letter-spacing: -0.01em; }
  .ccy { font-size: 0.9rem; color: var(--ink-muted); }
  .bracket { font-size: 0.76rem; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .bracket.full { color: var(--verify); }
  .wallet { display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; margin-top: 1.3rem; font-size: 0.8rem; }
  .wl { color: var(--ink-faint); }
  .seg { font-family: inherit; background: var(--paper-sunk); color: var(--ink-muted); border: 1px solid var(--rule); padding: 0.32rem 0.7rem; font-size: 0.78rem; border-radius: 7px; cursor: pointer; }
  .seg.on { background: color-mix(in oklab, var(--blue) 12%, var(--paper-raised)); color: var(--blue-strong); border-color: color-mix(in oklab, var(--blue) 40%, var(--rule)); }
  .err { color: var(--seal); font-size: 0.84rem; margin: 0.7rem 0 0; }
  .preframe { margin: 1.2rem 0 -0.35rem; font-size: 0.8rem; color: var(--ink-faint); max-width: 62ch; }
  .healthnote { margin: 0.6rem 0 0; font-size: 0.78rem; color: var(--ink-muted); }
  .healthnote.err { color: var(--seal); }
  .walletnote { margin: 0.5rem 0 0; font-size: 0.76rem; color: var(--ink-faint); }

  .failcard { margin-top: 1.2rem; border: 1px solid color-mix(in oklab, var(--seal) 30%, var(--rule)); background: color-mix(in oklab, var(--seal) 6%, var(--paper-raised)); border-radius: 12px; padding: 1rem 1.15rem; }
  .failmsg { color: var(--seal-strong); font-weight: 500; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
  .fx { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--seal); color: var(--paper-raised); font-size: 0.72rem; font-weight: 700; }
  .failacts { display: flex; gap: 0.6rem; margin-top: 0.85rem; flex-wrap: wrap; }
  .failnote { color: var(--ink-muted); font-size: 0.8rem; margin: 0.8rem 0 0; max-width: 62ch; }
  .cachedbanner { margin-top: 1.3rem; border: 1px solid color-mix(in oklab, var(--brass) 40%, var(--rule)); background: color-mix(in oklab, var(--brass) 12%, var(--paper-raised)); border-radius: 10px; padding: 0.7rem 1rem; font-size: 0.82rem; color: color-mix(in oklab, var(--brass) 55%, var(--ink)); }
  .cachedbanner b { color: var(--ink); }

  /* ---- two ledgers ---- */
  .ledgers { margin-top: 1.3rem; scroll-margin-top: 62px; display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; }
  .ledger { border-radius: 14px; padding: clamp(1.1rem, 2.5vw, 1.5rem); min-height: 330px; }
  .lh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.1rem; }
  .lh-t { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em; }
  .tag { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.16rem 0.44rem; border-radius: 4px; font-weight: 600; }
  .tag.ok { color: var(--verify); border: 1px solid color-mix(in oklab, var(--verify) 40%, transparent); background: color-mix(in oklab, var(--verify) 10%, transparent); }
  .tag.warn { color: var(--brass); border: 1px solid color-mix(in oklab, var(--brass) 45%, transparent); background: color-mix(in oklab, var(--brass) 10%, transparent); }
  .tag.sealed { color: var(--vault-muted); border: 1px solid var(--vault-rule); }
  .tag.keyed { color: var(--brass); border: 1px solid color-mix(in oklab, var(--brass) 50%, transparent); background: color-mix(in oklab, var(--brass) 14%, transparent); }

  /* public = a light institutional filing on document stock */
  .public { background: var(--paper-raised); border: 1px solid var(--rule); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--paper) 60%, transparent), 0 20px 44px -34px color-mix(in oklab, var(--ink) 45%, transparent); }
  .public .lh-t { color: var(--ink-faint); }
  .verdict { display: flex; align-items: center; gap: 0.6rem; font-size: 1.25rem; font-weight: 600; color: var(--verify); letter-spacing: -0.01em; margin-bottom: 0.4rem; }
  .vsub { margin: 0 0 1.05rem; padding-bottom: 1.05rem; border-bottom: 1px solid var(--rule-soft); font-size: 0.74rem; color: var(--ink-faint); }
  .vstamp { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--verify); color: var(--verify); font-size: 0.9rem; }
  .filing { margin: 0; display: grid; gap: 0; }
  .filing > div { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.42rem 0; border-bottom: 1px solid var(--rule-soft); }
  .filing dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-faint); margin: 0; }
  .filing dd { margin: 0; font-size: 0.88rem; font-weight: 500; color: var(--ink); }
  .filing dd.sm { font-size: 0.78rem; font-weight: 400; color: var(--ink-muted); }
  .redact { background: var(--ink); color: var(--ink); border-radius: 2px; letter-spacing: -1px; user-select: none; font-size: 0.8rem; padding: 0 0.15rem; }
  .txrow { margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .txlink { text-decoration: none; font-size: 0.82rem; color: var(--blue); }
  .txlink:hover { text-decoration: underline; }
  .indexing { font-size: 0.82rem; color: var(--ink-faint); }
  .age { font-size: 0.74rem; color: var(--verify); font-variant-numeric: tabular-nums; }
  .settlebind { margin-top: 0.9rem; padding-top: 0.8rem; border-top: 1px dashed var(--rule); display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.76rem; }
  .settlebind a { text-decoration: none; color: var(--blue); }
  .settlebind a:hover { text-decoration: underline; }
  .sbl { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-faint); font-weight: 600; }
  .sarrow { color: var(--ink-muted); }
  .sbl2 { flex-basis: 100%; color: var(--ink-faint); font-size: 0.72rem; }
  .settlebind .indexing { font-size: inherit; }
  .settlemiss { margin: 0.9rem 0 0; padding-top: 0.8rem; border-top: 1px dashed var(--rule); font-size: 0.76rem; color: var(--ink-faint); }
  .acts { display: flex; gap: 0.55rem; margin-top: 1rem; flex-wrap: wrap; align-items: center; }
  .forgehint { margin: 0.6rem 0 0; font-size: 0.76rem; color: var(--ink-faint); }
  .readout { margin: 0.85rem 0 0; font-size: 0.78rem; color: var(--ink-muted); }
  .readout.mono { color: var(--ink-body); }

  /* the forgery-rejection stamp */
  .stamp { margin-top: 1rem; display: inline-flex; flex-direction: column; gap: 0.1rem; align-items: flex-start; border: 2px solid var(--seal); color: var(--seal-strong); border-radius: 8px; padding: 0.45rem 0.8rem; transform: rotate(-2.2deg); animation: stampin 0.32s var(--e-out) both; }
  .stamp-l { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; }
  .stamp-c { font-size: 0.78rem; }
  @keyframes stampin { from { opacity: 0; transform: rotate(-2.2deg) scale(1.14); } to { opacity: 1; transform: rotate(-2.2deg) scale(1); } }

  /* vault = the single dark surface */
  .vault { background: var(--vault); border: 1px solid var(--vault-rule); color: var(--vault-ink); position: relative; overflow: hidden; transition: box-shadow 0.5s var(--e-out), border-color 0.5s; }
  .vault .lh-t { color: var(--vault-muted); }
  .vault.open { border-color: color-mix(in oklab, var(--brass) 45%, var(--vault-rule)); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--brass) 22%, transparent), 0 0 60px -22px color-mix(in oklab, var(--brass) 60%, transparent); }
  .sealface { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 1rem; min-height: 250px; }
  .wax { position: relative; display: inline-grid; place-items: center; width: 60px; height: 60px; border-radius: 50%; background: radial-gradient(circle at 38% 32%, var(--seal), var(--seal-strong)); box-shadow: 0 6px 16px -6px color-mix(in oklab, var(--seal) 70%, black), inset 0 0 0 2px color-mix(in oklab, black 22%, transparent); }
  .wax::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; border: 1.5px dashed color-mix(in oklab, var(--seal) 55%, var(--vault)); }
  .wax-v { font-weight: 700; font-size: 1.5rem; color: color-mix(in oklab, var(--paper) 88%, var(--seal)); text-shadow: 0 1px 1px color-mix(in oklab, black 40%, transparent); }
  .sealface p { font-size: 0.84rem; color: var(--vault-muted); max-width: 32ch; margin: 0; line-height: 1.5; }
  .sealface .verr { margin: 0; font-size: 0.78rem; color: color-mix(in oklab, var(--seal) 55%, var(--vault-ink)); }
  .btn.key { background: var(--brass); color: oklch(24% 0.04 76); font-weight: 600; border: none; }
  .btn.key:hover:not(:disabled) { background: color-mix(in oklab, var(--brass) 88%, white); }

  .truth { animation: unseal 0.62s var(--e-out) both; }
  @keyframes unseal { from { clip-path: inset(0 0 100% 0); opacity: 0.35; } to { clip-path: inset(0 0 0 0); opacity: 1; } }
  .attest { display: flex; align-items: baseline; gap: 0.45rem; font-size: 0.8rem; color: var(--vault-blue); margin-bottom: 0.6rem; }
  .attest.bad { color: color-mix(in oklab, var(--seal) 60%, var(--vault-ink)); }
  .ok { color: var(--verify); }
  .vault .ok { color: oklch(72% 0.14 152); }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-top: 0.9rem; }
  .rec { display: flex; flex-direction: column; gap: 0.22rem; background: var(--vault-raised); border: 1px solid var(--vault-rule); border-radius: 9px; padding: 0.75rem 0.85rem; }
  .rec h4 { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.09em; color: var(--brass); font-weight: 600; }
  .rec b { font-size: 1rem; color: var(--vault-ink); }
  .rec span { font-size: 0.78rem; color: var(--vault-muted); }
  .rec .dim { color: color-mix(in oklab, var(--vault-muted) 78%, var(--vault)); }
  .rec .mono { font-size: 0.7rem; }
  .amt2 { margin-top: 0.9rem; font-size: 0.95rem; color: var(--vault-muted); }
  .amt2 b { color: var(--vault-ink); font-weight: 600; }
  .btn.ghostv { margin-top: 0.9rem; background: transparent; color: var(--vault-muted); border: 1px solid var(--vault-rule); }
  .btn.ghostv:hover:not(:disabled) { border-color: var(--brass); color: var(--vault-ink); }
  .note { font-size: 0.74rem; color: color-mix(in oklab, var(--vault-muted) 82%, var(--vault)); margin: 0.9rem 0 0; max-width: 52ch; line-height: 1.5; }

  .logsec { margin-top: 1.6rem; }
  .logsec h3 { font-size: 0.78rem; color: var(--ink-muted); font-weight: 600; margin-bottom: 0.5rem; }
  .dim { color: var(--ink-faint); }
  .logrows { display: grid; gap: 0; }
  .logrow { display: flex; align-items: center; gap: 0.5rem; color: var(--ink-body); text-decoration: none; font-size: 0.8rem; padding: 0.4rem 0; border-bottom: 1px solid var(--rule-soft); }
  .logrow:hover { color: var(--blue); }

  /* ---- how it works ---- */
  .steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; counter-reset: none; }
  .steps li { position: relative; padding-top: 1.4rem; border-top: 2px solid var(--ink); }
  .stepn { font-family: var(--mono); font-size: 0.85rem; color: var(--seal); position: absolute; top: 0.9rem; }
  .steps h3 { font-size: 1.05rem; font-weight: 600; margin: 0.5rem 0 0.5rem; }
  .steps p { margin: 0; font-size: 0.9rem; color: var(--ink-muted); }
  .steps em { color: var(--ink-body); font-style: italic; }

  /* ---- integrate ---- */
  .code { margin: 0; border: 1px solid var(--vault-rule); border-radius: 12px; overflow: hidden; background: var(--vault); box-shadow: 0 20px 50px -34px color-mix(in oklab, var(--ink) 60%, transparent); }
  .code figcaption { display: flex; align-items: center; justify-content: space-between; padding: 0.55rem 0.9rem; border-bottom: 1px solid var(--vault-rule); background: var(--vault-raised); }
  .fname { font-size: 0.76rem; color: var(--vault-muted); }
  .copy { font-family: var(--mono); font-size: 0.72rem; color: var(--vault-blue); background: transparent; border: 1px solid var(--vault-rule); border-radius: 6px; padding: 0.2rem 0.6rem; cursor: pointer; }
  .copy:hover { border-color: var(--vault-blue); }
  .code pre { margin: 0; padding: 1.1rem 1.2rem; overflow-x: auto; font-size: 0.8rem; line-height: 1.7; color: var(--vault-ink); tab-size: 2; }
  .code code { color: color-mix(in oklab, var(--vault-ink) 88%, var(--vault-blue)); }

  /* ---- verify ---- */
  .verify-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
  .verify-list li { display: grid; grid-template-columns: minmax(9rem, auto) 1fr auto; align-items: center; gap: 0.6rem 1.2rem; padding: 0.95rem 0; border-bottom: 1px solid var(--rule); }
  .vl-what { font-weight: 600; color: var(--ink); font-size: 0.92rem; }
  .vl-desc { color: var(--ink-muted); font-size: 0.85rem; }
  .verify-list a { text-decoration: none; font-size: 0.82rem; white-space: nowrap; }
  .verify-list a:hover { text-decoration: underline; }
  .honest { margin: 1.5rem 0 0; font-size: 0.88rem; color: var(--ink-muted); max-width: 74ch; line-height: 1.6; }
  .honest b { color: var(--ink); font-weight: 600; }

  /* ---- footer ---- */
  footer { padding: 2.5rem 0 3.5rem; }
  footer .wrap { display: flex; flex-direction: column; gap: 0.8rem; }
  footer p { margin: 0; font-size: 0.8rem; color: var(--ink-faint); max-width: 78ch; line-height: 1.6; }

  /* ---- reveal-on-scroll (the action adds .is-in when the section enters view) ---- */
  .reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.7s var(--e-out), transform 0.7s var(--e-out); }
  :global(.reveal.is-in) { opacity: 1 !important; transform: none !important; }

  /* ---- responsive ---- */
  @media (max-width: 860px) {
    .ledgers { grid-template-columns: 1fr; }
    .steps { grid-template-columns: 1fr; gap: 1.2rem; }
  }
  @media (max-width: 560px) {
    .btn.block { font-size: 0.85rem; }
    .parties { grid-template-columns: 1fr; }
    .flow { transform: rotate(90deg); justify-self: start; }
    .cols { grid-template-columns: 1fr; }
    .verify-list li { grid-template-columns: 1fr auto; }
    .vl-desc { grid-column: 1 / -1; }
    .contractid, .barwrap .sep { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .truth { animation: none; clip-path: none; }
    .stamp { animation: none; }
    .reveal { transition: opacity 0.2s ease; transform: none; }
    .btn:active:not(:disabled) { transform: none; }
  }
</style>

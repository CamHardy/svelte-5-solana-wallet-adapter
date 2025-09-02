<script>
  import {
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    Transaction
  } from '@solana/web3.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getWallet } from '$lib/context.js';
	import WalletConnectButton from "$lib/components/WalletConnectButton.svelte";
	import { waitForSignature } from '$lib/waitForSignature.js';
	import { sendAndWait } from '$lib/client.svelte';
	/** @import { Connection } from '@solana/web3.js' */

	const wallet = getWallet();

  const connected  = $derived(wallet.state.connected);
  const pubkeyStr  = $derived(wallet.state.publicKey);
  const name       = $derived(() => {
    const id = wallet.state.activeId;
    const w = wallet.wallets.find((x) => x.id === id);
    return w?.name ?? '—';
  });

  let status = $state('');
	/** @type { number | null } */
  let balanceLamports = $state(null);

  let toAddr = $state('');
  let amountSol = $state(0.01);

	/** @param { string } s */
  function note(s) { status = s; }
  function assertReady() {
    if (!connected || !pubkeyStr) throw new Error('Connect a wallet first.');
    if (!wallet.connection) throw new Error('RPC not initialized.');
  }

  async function refreshBalance() {
    try {
      assertReady();
      const pk = new PublicKey(/** @type {string} */ (pubkeyStr));
      const lamports = await wallet.connection?.getBalance(pk, 'confirmed');
      balanceLamports = /** @type { number } */ (lamports);
      note('Balance refreshed.');
    } catch (/** @type { any } */ e) {
      note(`Balance error: ${e?.message || e}`);
    }
  }

  async function airdrop1() {
    try {
      assertReady();
      const pk = new PublicKey(/** @type {string} */ (pubkeyStr));
      note('Requesting 1 SOL airdrop… (devnet only)');
      const sig = await wallet.connection?.requestAirdrop(pk, 1 * LAMPORTS_PER_SOL);
			await waitForSignature({
				connection: /** @type { Connection } */ (wallet.connection),
				signature: /** @type { string } */ (sig),
				commitment: 'confirmed',
				pollMs: 500,
				maxMs: 90_000
			});
			note(`Airdrop confirmed: ${sig?.slice(0, 8)}…`);
      await refreshBalance();
    } catch (/** @type { any } */ e) {
      note(`Airdrop error: ${e?.message || e}`);
    }
  }

  async function signDemo() {
    try {
      assertReady();
      const msg = `Hello from Svelte ${new Date().toISOString()}`;
      const bytes = new TextEncoder().encode(msg);
      const sig = await wallet.signMessage(bytes);
      // show hex so we avoid extra deps
      const hex = Array.from(/** @type { Uint8Array } */ (sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
      note(`Signed message (${msg.length} chars), sig[hex] ${hex.slice(0, 16)}…`);
    } catch (/** @type { any } */ e) {
      note(`signMessage error: ${e?.message || e}`);
    }
  }

  async function sendSol() {
    try {
      assertReady();
      const from = new PublicKey(/** @type { string } */ (pubkeyStr));
      const to = new PublicKey(toAddr.trim());
      const lamports = Math.round((amountSol || 0) * LAMPORTS_PER_SOL);

      if (lamports <= 0) throw new Error('Amount must be > 0.');
      note('Building transfer…');

      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports })
      );

      note('Sending transaction…');
			const sig = await sendAndWait({
				connection: /** @type { Connection } */ (wallet.connection),
				sendTx: (t) => wallet.sendTransaction(t),
				tx,
				feePayer: from,
				commitment: 'confirmed',
				pollMs: 500,
				maxMs: 90_000
			});
			
      note(`Transfer confirmed: ${sig.slice(0, 8)}…`);
      await refreshBalance();
    } catch (/** @type { any } */ e) {
      note(`Transfer error: ${e?.message || e}`);
    }
  }

  // auto-refresh when we connect/switch accounts
  $effect(() => {
    if (connected && pubkeyStr && wallet.connection) {
      refreshBalance();
    } else {
      balanceLamports = null;
    }
  });
</script>

<div class="flex justify-center w-full py-12">
	<div class="max-w-2xl rounded-2xl border border-black/10 p-4 space-y-4">
		<WalletConnectButton />

		<div class="h-px bg-black/10"></div>

		<div class="text-sm text-black/60">Wallet</div>
		<div class="text-sm">
			<div><span class="font-medium">Name:</span> {name()}</div>
			<div><span class="font-medium">Public Key:</span> {pubkeyStr ?? '—'}</div>
			<div><span class="font-medium">Connected:</span> {connected ? 'Yes' : 'No'}</div>
		</div>

		<div class="h-px bg-black/10"></div>

		<div class="flex items-center gap-3">
			<Button
				class="cursor-pointer"
				disabled={!connected}
				onclick={refreshBalance}>Refresh Balance</Button>
			<div class="text-sm">
				<span class="font-medium">Balance:</span>
				{#if balanceLamports !== null}
					{(balanceLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL
				{:else}
					—
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-3">
			<Button
				class="cursor-pointer"
				disabled={!connected}
				onclick={airdrop1}>Devnet Airdrop 1 SOL</Button>
			<span class="text-xs text-black/60">Only works on devnet</span>
		</div>

		<div class="flex items-center gap-3">
			<Button
				class="cursor-pointer"
				disabled={!connected}
				onclick={signDemo}>Sign Message</Button>
			<span class="text-xs text-black/60">Signs a short string; shows first 8 bytes of hex</span>
		</div>

		<div class="space-y-2">
			<div class="text-sm font-medium">Send SOL</div>
			<div class="flex flex-wrap items-center gap-2">
				<input
					class="px-3 py-1.5 rounded-lg border border-black/10 min-w-[22rem]"
					placeholder="Recipient address (PublicKey)"
					bind:value={toAddr}
				/>
				<input
					class="px-3 py-1.5 rounded-lg border border-black/10 w-28"
					type="number"
					step="0.001"
					min="0"
					bind:value={amountSol}
				/>
				<Button
					class="cursor-pointer"
					disabled={!connected || !toAddr}
					onclick={sendSol}>Send</Button>
			</div>
			<div class="text-xs text-black/60">Uses `SystemProgram.transfer` and your wallet as fee payer.</div>
		</div>

		{#if status}
			<div class="rounded-lg border border-black/10 bg-black/5 p-2 text-sm">{status}</div>
		{/if}
	</div>
</div>
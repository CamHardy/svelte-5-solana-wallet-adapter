<script>
  import { getWallet } from '$lib/context.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import WalletConnectDialog from '$lib/components/WalletConnectDialog.svelte';

  // grab the wallet client from context
  const wallet = getWallet();

  // derive tracked values
	const wallets = $derived(wallet.wallets);
  const connected   = $derived(wallet.state.connected);
  const connecting  = $derived(wallet.state.connecting);
	const provider    = $derived(wallet.state.activeId);
  const pubkeyShort = $derived(wallet.shortAddr(wallet.state.publicKey));
	const activeWallet = $derived(wallets.find(w => w.id === provider));

  function onclick() {
    if (!connected) wallet.openDialog();
    else wallet.disconnect();
  }
</script>

<WalletConnectDialog />

<Button
  class="inline-flex cursor-pointer items-center gap-2 w-36"
  aria-label={connected ? 'Disconnect wallet' : 'Connect wallet'}
  disabled={connecting}
  {onclick}
>
  {#if connected}
		{#if activeWallet}
    	<img src={activeWallet.icon} alt={activeWallet.name} class="w-6 h-6">
		{:else} 
			<span>Wallet</span>
		{/if}
    <span>{pubkeyShort}</span>
  {:else}
    <span>{connecting ? 'Connecting…' : 'Connect Wallet'}</span>
  {/if}
</Button>
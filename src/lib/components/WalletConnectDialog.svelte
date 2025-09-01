<script>
  import { getWallet } from '$lib/context.js';
  import { WalletReadyState } from '@solana/wallet-adapter-base';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

  const wallet = getWallet();

  const providers  = $derived(wallet.wallets);
  const connecting = $derived(wallet.state.connecting);
  const errorText  = $derived(wallet.state.error);

	/** @param { WalletReadyState } r */
	function readyLabel(r) {
    switch (r) {
      case WalletReadyState.Installed: return 'Installed';
      case WalletReadyState.Loadable: return 'Loadable';
      case WalletReadyState.NotDetected: return 'Not detected';
      default: return 'Unsupported';
    }
  }
</script>

<Dialog.Root bind:open={wallet.ui.dialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Connect a Wallet</Dialog.Title>
		</Dialog.Header>
      {#if errorText}
        <div class="px-4 pt-3 text-sm text-red-600">{errorText}</div>
      {/if}

      <div class="p-2">
        {#if (providers?.length ?? 0) === 0}
          <div class="p-4 text-sm">
            No wallets detected. Install one of these:
            <ul class="list-disc ml-6 mt-2 space-y-1">
              <li><a class="underline" href="https://phantom.app/" target="_blank" rel="noreferrer">Phantom</a></li>
              <li><a class="underline" href="https://solflare.com/" target="_blank" rel="noreferrer">Solflare</a></li>
              <li><a class="underline" href="https://backpack.app/" target="_blank" rel="noreferrer">Backpack</a></li>
            </ul>
          </div>
        {:else}
          <ul class="divide-y divide-black/5">
            {#each providers as p}
              <li class="flex items-center justify-between gap-3 p-3">
                <div class="flex items-center gap-3">
                  <img src={p.icon} alt={p.name} class="w-8 h-8">
                  <div class="leading-tight">
                    <div class="font-medium">{p.name}</div>
                		<div class="text-xs text-white/60">{readyLabel(p.ready)}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  {#if p.ready === 'Installed'}
                    <Button
                      class="px-3 py-1.5 cursor-pointer"
                      disabled={connecting}
                      onclick={() => {
												wallet.connectById(p.id);
											}}
                    >
                      {connecting ? 'Connecting…' : 'Connect'}
                    </Button>
                  {:else}
                    <Button
                      class="px-3 py-1.5 cursor-pointer"
                      href={p.adapter.url}
                      target="_blank"
											disabled={false}
                      rel="noreferrer"
                    >
                      Install
									</Button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="p-3 border-t border-black/10 text-xs text-black/60">
        You can safely close this dialog at any time.
      </div>
  </Dialog.Content>
</Dialog.Root>


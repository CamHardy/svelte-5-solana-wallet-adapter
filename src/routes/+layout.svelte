<script>
	import '../app.css';
	import { onMount } from 'svelte';
  import { provideWallet, mountWallet } from '$lib//context.js';

	provideWallet();
	
  onMount(() => {
		mountWallet('https://api.devnet.solana.com');
  });
	
	let { children } = $props();
</script>

{@render children()}

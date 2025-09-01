import { setContext, getContext } from 'svelte';
import { walletClient, WalletClient } from './client.svelte.js';

export const WALLET_CTX_KEY = 'app:sol-wallet';

export function provideWallet() {
  setContext(WALLET_CTX_KEY, walletClient);
}

export function getWallet() {
  /** @type { WalletClient } */
  const w = getContext(WALLET_CTX_KEY);
  if (!w) throw new Error('Wallet context missing: call provideWallet() first.');
  return w;
}

/** @param { string } endpoint */
export function mountWallet(endpoint) {
  walletClient.mount(endpoint);
}

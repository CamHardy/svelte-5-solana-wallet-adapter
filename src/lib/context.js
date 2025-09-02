import { setContext, getContext } from 'svelte';
import { walletClient, WalletClient } from './client.svelte.js';
/** @import { Commitment, Connection } from '@solana/web3.js'; */

/**
 * @typedef CommitmentOpts
 * @property { Connection } connection
 * @property { string } signature
 * @property { number } lastValidBlockHeight
 * @property { Commitment } [commitment]
 * @property { number } [pollMs]
 * @property { number } [maxMs]
 */
/** @param { CommitmentOpts } opts */
export async function waitForSignatureWithExpiry({
  connection,
  signature,
  lastValidBlockHeight,
  commitment = 'confirmed',
  pollMs = 500,
  maxMs = 60_000, // safety net
}) {
  const start = Date.now();
  for (;;) {
    // 1) check status
    const { value } = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const st = value[0];
    if (st?.err) throw new Error(`Transaction error: ${JSON.stringify(st.err)}`);
    const cs = st?.confirmationStatus; // 'processed' | 'confirmed' | 'finalized' | undefined
    if (cs === 'confirmed' || cs === 'finalized') return st;

    // 2) check expiry
    const h = await connection.getBlockHeight(commitment);
    if (h > lastValidBlockHeight) throw new Error('Transaction expired (blockhash invalid).');

    if (Date.now() - start > maxMs) throw new Error('Timed out waiting for confirmation.');
    await new Promise(r => setTimeout(r, pollMs));
  }
}


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
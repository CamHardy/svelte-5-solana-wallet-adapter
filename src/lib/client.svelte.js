import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
/** @import { Commitment, Transaction } from '@solana/web3.js' */
import { WalletReadyState, BaseMessageSignerWalletAdapter } from '@solana/wallet-adapter-base';
/** @import { WalletAdapter } from '@solana/wallet-adapter-base' */
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { waitForSignature } from '$lib/waitForSignature.js';

/** 
 * @typedef Opts
 * @property { Connection } connection
 * @property { (tx: Transaction) => Promise<string> } sendTx
 * @property { Transaction } tx
 * @property { PublicKey } feePayer
 * @property { Commitment } [commitment]
 * @property { number } [pollMs]
 * @property { number } [maxMs]
 */
/** @param { Opts } opts */
export async function sendAndWait({
  connection,
  sendTx,                     // (tx) => signature (wallet adapter)
  tx,
  feePayer,                   // PublicKey (from wallet)
  commitment = 'confirmed',
  pollMs = 500,
  maxMs = 60_000
}) {
  // grab a blockhash BEFORE sending, to enable expiry checks
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({ commitment });
  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayer;

  const sig = await sendTx(tx);
  await waitForSignature({ connection, signature: sig, commitment, lastValidBlockHeight, pollMs, maxMs });
  return sig;
}

/**
 * @typedef UiWallet
 * @property { string } id
 * @property { string } name
 * @property { string } icon
 * @property { WalletAdapter } adapter
 * @property { WalletReadyState } ready
 */

export class WalletClient {
  state = $state({
    connected: false,
    connecting: false,
    /** @type { string | null } */
    publicKey: null,
    /** @type { string | null } */
    activeId: null,
    /** @type { string | null } */
    error: null
  });

  ui = $state({ dialogOpen: false });
  /** @type { UiWallet[] } */
  wallets = $state([]);
  /** @type { Connection | null } */
  connection = $state(null);
  /** @type { 'confirmed' | 'finalized' | 'processed' } */
  commitment = 'confirmed';
  /** @type { Array<() => void> } */
  #listeners = [];

  /** @param { string | null } k */
  shortAddr(k) { return k ? `${k.slice(0, 4)}…${k.slice(-4)}` : ''; }

  /** @param { string | null } endpoint */
  initRpc(endpoint = null) {
    const url = endpoint ?? clusterApiUrl('mainnet-beta'); //TODO: swap for devnet in dev
    this.connection = new Connection(url, this.commitment);
  }

  buildAdapters() {
    /** @type { WalletAdapter[] } */
    const adapters = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter()
    ];

    this.wallets = adapters.map((adapter) => ({
      id: adapter.name.toLowerCase(),
      name: adapter.name,
      icon: adapter.icon,
      adapter,
      ready: adapter.readyState
    }));

    for (const w of this.wallets) {
      /** @param { WalletReadyState } rs */
      const onReadyChange = (rs) => {
        w.ready = rs;
        // force reactive assignment
        this.wallets = [...this.wallets];
      };
      w.adapter.on('readyStateChange', onReadyChange);
      this.#listeners.push(() => w.adapter.off('readyStateChange', onReadyChange));
    }
  }

  /** @param { string } [endpoint] */
  mount(endpoint) {
    if (!this.connection) this.initRpc(endpoint);
    this.buildAdapters();

    for (const w of this.wallets) {
      const onConnect = () => this.#syncAfterConnect(w);
      const onDisconnect = () => this.#syncAfterDisconnect(w);
      /** @param { any } e */
      const onError = (e) => (this.state.error = e?.message || String(e));

      w.adapter.on('connect', onConnect);
      w.adapter.on('disconnect', onDisconnect);
      w.adapter.on('error', onError);

      this.#listeners.push(() => {
        w.adapter.off('connect', onConnect);
        w.adapter.off('disconnect', onDisconnect);
        w.adapter.off('error', onError);
      });
    }

    return () => this.unmount();
  }

  unmount() {
    for (const off of this.#listeners) off();
    this.#listeners = [];
  }

  openDialog() { this.ui.dialogOpen = true; }
  closeDialog() { this.ui.dialogOpen = false; }

  /** @param { string } id */
  async connectById(id) {
    const w = this.wallets.find((x) => x.id === id);
    if (!w) { this.state.error = 'Wallet not found.'; return; }

    if (w.ready === WalletReadyState.Unsupported) {
      this.state.error = `${w.name} is not supported in this environment.`;
      return;
    }

    if (w.ready === WalletReadyState.NotDetected) {
      this.state.error = `${w.name} not detected (install the extension/app).`;
      return;
    }

    try {
      this.state.connecting = true;
      this.state.error = null;

      await w.adapter.connect(); // opens the wallet UI if needed

      this.#syncAfterConnect(w);
      this.closeDialog();
    } catch (/** @type { any } */ e) {
      this.state.error = e?.message || String(e);
    } finally {
      this.state.connecting = false;
    }
  }

  async disconnect() {
    const active = this.#activeWallet();
    try { await active?.adapter.disconnect(); } catch {}
    this.#syncAfterDisconnect(active ?? null);
  }

  // Helpers that leverage adapter + web3.js

  /** @returns { PublicKey | null } */
  getPublicKey() {
    const active = this.#activeWallet();
    return /** @type { PublicKey | null } */ (active?.adapter.publicKey);
  }

  /** @param { Uint8Array } bytes */
  async signMessage(bytes) {
    const active = this.#activeWallet();
    if (!active) throw new Error('No active wallet.');
    const a = /** @type { BaseMessageSignerWalletAdapter } */ (active.adapter);
    if (!a.signMessage) throw new Error('signMessage not supported.');
    return a.signMessage(bytes);
  }

  /** 
   * @param { Transaction } tx 
   * @param {{ skipPreflight?: boolean }} [opts]
   */
  async sendTransaction(tx, opts) {
    if (!this.connection) throw new Error('RPC not initialized');
    const active = this.#activeWallet();
    if (!active) throw new Error('No active wallet.');
    const sig = await active.adapter.sendTransaction(tx, this.connection, opts);
    return sig; // return signature; caller can await confirmation
  }

  // — private — //
  #activeWallet() {
    if (!this.state.activeId) return null;
    return this.wallets.find((w) => w.id === this.state.activeId) ?? null;
  }

  /** @param { UiWallet } w */
  #syncAfterConnect(w) {
    this.state.connected = true;
    this.state.publicKey = w.adapter.publicKey?.toBase58?.() ?? null;
    this.state.activeId = w.id;
  }

  /** @param { UiWallet | null } _w */
  #syncAfterDisconnect(_w) {
    this.state = { connected: false, connecting: false, publicKey: null, activeId: null, error: null };
  }
}

export const walletClient = new WalletClient();

export function useWallet() {
  return {
    state: walletClient.state,
    ui: walletClient.ui,
    wallets: walletClient.wallets,
    connection: walletClient.connection,

    shortAddr: walletClient.shortAddr.bind(walletClient),
    openDialog: () => walletClient.openDialog(),
    closeDialog: () => walletClient.closeDialog(),
    /** @param { string } id */
    connectById: async (id) => await walletClient.connectById(id),
    disconnect: async () => await walletClient.disconnect(),
    getPublicKey: () => walletClient.getPublicKey(),
    /** @param { Uint8Array } m */
    signMessage: async (m) => await walletClient.signMessage(m),
    /**
     * @param { Transaction } tx 
     * @param {{ skipPreflight?: boolean }} [opts] 
     */
    sendTransaction: async (tx, opts) =>
      await walletClient.sendTransaction(tx, opts)
  };
}
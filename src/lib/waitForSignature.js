/** @import { Commitment, Connection, RpcResponseAndContext, SignatureStatus } from '@solana/web3.js' */

/**
 * Polls getSignatureStatuses until the signature reaches the requested commitment.
 * If `lastValidBlockHeight` is provided, also aborts when the tx expires.
 */
/** 
 * @typedef CommitmentOpts
 * @property { Connection } connection
 * @property { string } signature
 * @property { number } [lastValidBlockHeight]
 * @property { Commitment } [commitment]
 * @property { number } [pollMs]
 * @property { number } [maxMs]
 * @property { boolean } [searchHistory]
 */
/** @param { CommitmentOpts } opts */
export async function waitForSignature({
  connection,
  signature,
  commitment = 'confirmed',
  lastValidBlockHeight,   // optional: if you built the tx yourself
  pollMs = 500,
  maxMs = 60_000,
  searchHistory = true
}) {
  const start = Date.now();

	/** @param { SignatureStatus['confirmationStatus'] | undefined } cs */
  function satisfied(cs) {
    if (!cs) return false;
    if (commitment === 'processed') return cs === 'processed' || cs === 'confirmed' || cs === 'finalized';
    if (commitment === 'confirmed') return cs === 'confirmed' || cs === 'finalized';
    return cs === 'finalized';
  }

  for (;;) {
    const res = await connection.getSignatureStatuses([signature], { searchTransactionHistory: searchHistory });
    const st = res.value[0];

    if (st?.err) {
      throw new Error(`Transaction error: ${JSON.stringify(st.err)}`);
    }
    if (satisfied(st?.confirmationStatus)) {
      return { context: res.context, value: st ?? null };
    }

    if (lastValidBlockHeight !== undefined) {
      const h = await connection.getBlockHeight(commitment);
      if (h > lastValidBlockHeight) throw new Error('Transaction expired (blockhash invalid).');
    }

    if (Date.now() - start > maxMs) throw new Error('Timed out waiting for confirmation.');

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

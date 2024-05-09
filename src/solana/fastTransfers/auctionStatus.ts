import { contracts, encoding } from "@wormhole-foundation/sdk";
import { SolanaAddress } from "@wormhole-foundation/sdk-solana";
import { Context, Next } from "koa";
import { Auction, FastTransferAuctionStatusRequest } from "./types.js";
import {
  SOLANA_SEQ_LOG,
  buildProgramAndConnection,
  deriveAuctionAddress,
  findExecuteOrderLog,
  mapAuctionStatus,
  mapTargetProtocol,
} from "./utils.js";

export async function fastTransferAuctionStatus(ctx: Context, next: Next) {
  const request = { ...ctx.query } as unknown as FastTransferAuctionStatusRequest;
  console.log("Request fastTransferAuctionStatus with parameters:", JSON.stringify(request));

  if (!request.digest || !request.network) {
    ctx.body = "Missing parameters, we need to have: digest, network";
    ctx.status = 400;
    return;
  }

  if (!encoding.hex.valid(request.digest)) {
    ctx.body = "Invalid digest, it should be a hex string";
    ctx.status = 400;
    return;
  }

  const { connection, network, program, programId } = buildProgramAndConnection(request.network);

  const digest = Buffer.from(request.digest, "hex");

  const auctionAddress = deriveAuctionAddress(programId, digest);
  const auction: Auction = await program.account.auction.fetchNullable(auctionAddress);

  const result = {
    status: mapAuctionStatus(auction),
    targetProtocol: mapTargetProtocol(auction),
    vaaHash: auction?.vaaHash ? Buffer.from(auction.vaaHash).toString("hex") : null,
    vaaTimestamp: auction?.vaaTimestamp ? auction.vaaTimestamp.toString() : null,
    info: auction?.info
      ? {
          configId: auction.info.configId,
          custodyTokenBump: auction.info.custodyTokenBump,
          vaaSequence: auction.info.vaaSequence.toString(),
          sourceChain: auction.info.sourceChain,
          bestOfferAccount: auction.info.bestOfferToken.toString(),
          bestOfferAccountOwner: (await connection.getAccountInfo(auction.info.bestOfferToken))?.owner.toString(),
          initialOfferAccount: auction.info.initialOfferToken.toString(),
          initialOfferAccountOwner: (
            await connection.getAccountInfo(auction.info.initialOfferToken)
          )?.owner.toString(),
          startSlot: auction.info.startSlot.toString(),
          amountIn: auction.info.amountIn.toString(),
          securityDeposit: auction.info.securityDeposit.toString(),
          offerPrice: auction.info.offerPrice.toString(),
          destinationAssetInfo: auction.info.destinationAssetInfo
            ? {
                custodyTokenBump: auction.info.destinationAssetInfo.custodyTokenBump,
                amountOut: auction.info.destinationAssetInfo.amountOut.toString(),
              }
            : null,
        }
      : null,
    fill: null,
  };

  // once the auction is completed search for the fill tx that sends the funds to the final recipient
  if (result.status.completed || result.status.settled) {
    const txs = await connection.getSignaturesForAddress(auctionAddress);
    for (const { signature } of txs) {
      const tx = await connection.getTransaction(signature, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      });

      // // check that the OrderExecuted event was emitted
      const log = findExecuteOrderLog(program, tx);
      if (!log) continue;

      result.fill = {
        txHash: signature,
      };

      const sequence = tx.meta.logMessages.find(l => l.startsWith(SOLANA_SEQ_LOG))?.replace(SOLANA_SEQ_LOG, "");
      if (!sequence) continue;

      const accounts = tx.transaction.message.staticAccountKeys;
      const whCoreProgramId = contracts.coreBridge.get(network, "Solana");
      const whCoreIx = tx.meta.innerInstructions
        .flatMap(i => i.instructions)
        .find(i => accounts[i.programIdIndex].toBase58() === whCoreProgramId);
      if (!whCoreIx) continue;

      const emitter = new SolanaAddress(accounts[whCoreIx.accounts[2]]).toUniversalAddress();

      result.fill.vaa = {
        emitterChain: 1,
        emitterAddress: emitter.toString().replace("0x", ""),
        sequence: sequence.toString(),
      };
    }
  }

  ctx.body = result;
  ctx.status = 200;
  return;
}

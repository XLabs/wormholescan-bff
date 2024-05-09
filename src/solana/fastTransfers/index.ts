import { Program, web3 } from "@coral-xyz/anchor";
import { Network, encoding } from "@wormhole-foundation/sdk";
import { deserializePostMessage } from "@wormhole-foundation/sdk-solana-core";
import { Context, Next } from "koa";
import { getSolanaRpc } from "../../utils.js";
import { MatchingEngine } from "./idl/matching_engine.js";
import MatchingEngineIDL from "./idl/matching_engine.json";
import { Auction } from "./types.js";

export interface FastTransferAuctionStatusRequest {
  network: Network;
  digest: string;
}

const IX_DATA_EXECUTE_CCTP = "b0261e11e64ece9d";
const IX_DATA_EXECUTE_LOCAL = "8cce1af3f34218f0";

const programId = new web3.PublicKey("mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS");

function deriveAuctionAddress(programId: web3.PublicKey, vaaHash: Array<number> | Buffer | Uint8Array) {
  return web3.PublicKey.findProgramAddressSync([Buffer.from("auction"), Buffer.from(vaaHash)], programId)[0];
}

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

  const rpc = getSolanaRpc(request.network);
  const connection = new web3.Connection(rpc);
  const program = new Program<MatchingEngine>(
    { ...(MatchingEngineIDL as any), address: programId },
    { connection },
  );

  const digest = Buffer.from(request.digest, "hex");

  const auctionAddress = deriveAuctionAddress(programId, digest);
  const auction: Auction = await program.account.auction.fetchNullable(auctionAddress);

  const result = {
    status: mapAuctionStatus(auction),
    targetProtocol: mapTargetProtocol(auction),
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

      const ix = tx?.transaction.message.compiledInstructions.find(ix =>
        [IX_DATA_EXECUTE_CCTP, IX_DATA_EXECUTE_LOCAL].includes(Buffer.from(ix.data).toString("hex")),
      );
      if (!ix) continue;

      const log = tx?.meta?.logMessages
        ?.filter(l => l.startsWith("Program data: "))
        .map(l => {
          const cleantLog = l.substring("Program data: ".length).trim();
          return program.coder.events.decode(cleantLog);
        })
        .find(l => l.name === "orderExecuted");
      if (!log) continue;

      // TODO: search for the vaa id on the tx accounts/log
      result.fill = {
        txHash: signature,
      };
    }
  }

  ctx.body = result;
  ctx.status = 200;
  return;
}

const mapAuctionStatus = (auction?: Auction) => {
  if (!auction || !!auction.status.notStarted) return { notStarted: {} };
  if (!!auction.status.active) return { active: {} };
  if (!!auction.status.completed) {
    return {
      completed: {
        slot: auction.status.completed.slot.toString(),
        executePenalty: auction.status.completed.executePenalty?.toString(),
      },
    };
  }
  if (!!auction.status.settled) {
    return {
      settled: {
        fee: auction.status.settled.fee.toString(),
        totalPenalty: auction.status.settled.totalPenalty?.toString(),
      },
    };
  }

  // TODO: how to handle when there was no auction created? Assume notStarted?
  return { notStarted: {} };
};

const mapTargetProtocol = (auction?: Auction) => {
  if (!!auction?.targetProtocol?.local)
    return { local: { programId: auction.targetProtocol.local.programId.toString() } };
  if (!!auction?.targetProtocol?.cctp) return { cctp: { domain: auction.targetProtocol.cctp.domain } };
  return { none: {} };
};

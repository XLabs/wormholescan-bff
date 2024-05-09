import { Program, web3 } from "@coral-xyz/anchor";
import { Network, contracts, encoding } from "@wormhole-foundation/sdk";
import { SolanaAddress, SolanaZeroAddress } from "@wormhole-foundation/sdk-solana";
import { Context, Next } from "koa";
import { getSolanaRpc } from "../../utils.js";
import { MatchingEngine } from "./idl/matching_engine.js";
import MatchingEngineIDL from "./idl/matching_engine.json";
import { Auction } from "./types.js";
import { SolanaWormholeCore, deserializePostMessage } from "@wormhole-foundation/sdk-solana-core";

export interface FastTransferAuctionStatusRequest {
  network: Network;
  digest: string;
}

export interface FastTransferFindOrderForFillRequest {
  network: Network;
  fillTxHash: string;
}

const IX_DATA_EXECUTE_CCTP = "b0261e11e64ece9d";
const IX_DATA_EXECUTE_LOCAL = "8cce1af3f34218f0";

const SOLANA_SEQ_LOG = "Program log: Sequence: ";

function deriveAuctionAddress(programId: web3.PublicKey, vaaHash: Array<number> | Buffer | Uint8Array) {
  return web3.PublicKey.findProgramAddressSync([Buffer.from("auction"), Buffer.from(vaaHash)], programId)[0];
}

const matchingEngineProgramId = (network: Network) => {
  if (network === "Mainnet")
    return new web3.PublicKey(process.env.LIQUIDITY_LAYER_PROGRAM_ID_MAINNET || SolanaZeroAddress);
  return new web3.PublicKey(
    process.env.LIQUIDITY_LAYER_PROGRAM_ID_TESTNET || "mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS",
  );
};

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

  const { connection, network, program, programId } = getProgram(request.network);

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

      const executeOrderIx = tx?.transaction.message.compiledInstructions.find(ix =>
        [IX_DATA_EXECUTE_CCTP, IX_DATA_EXECUTE_LOCAL].includes(Buffer.from(ix.data).toString("hex")),
      );
      if (!executeOrderIx) continue;

      // check that the OrderExecuted event was emitted
      const log = tx?.meta?.logMessages
        ?.filter(l => l.startsWith("Program data: "))
        .map(l => {
          const cleantLog = l.substring("Program data: ".length).trim();
          return program.coder.events.decode(cleantLog);
        })
        .find(l => l.name === "orderExecuted");
      if (!log) continue;

      result.fill = {
        txHash: signature,
      };

      const ixDataHex = Buffer.from(executeOrderIx.data).toString("hex");
      // only the execute_fast_order_cctp instruction emits a vaa
      if (ixDataHex === IX_DATA_EXECUTE_CCTP) {
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

const normalizeNetwork = (network: string): Network =>
  network.toLowerCase() === "mainnet" ? "Mainnet" : "Testnet";

export async function fastTransferFindOrderForFill(ctx: Context, next: Next) {
  const request = { ...ctx.query } as unknown as FastTransferFindOrderForFillRequest;

  if (!request.fillTxHash || !request.network) {
    ctx.body = "Missing parameters, we need to have: fillTxHash, network";
    ctx.status = 400;
    return;
  }

  const { program, connection, network } = getProgram(request.network);

  const tx = await connection.getTransaction(request.fillTxHash, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    ctx.body = "Fill transaction not found";
    ctx.status = 404;
    return;
  }

  const executeOrderIx = tx?.transaction.message.compiledInstructions.find(ix =>
    [IX_DATA_EXECUTE_CCTP, IX_DATA_EXECUTE_LOCAL].includes(Buffer.from(ix.data).toString("hex")),
  );
  if (!executeOrderIx) {
    ctx.body = "Transaction does not contain an execute order instruction";
    ctx.status = 404;
    return;
  }

  // check that the OrderExecuted event was emitted
  const log = tx?.meta?.logMessages
    ?.filter(l => l.startsWith("Program data: "))
    .map(l => {
      const cleantLog = l.substring("Program data: ".length).trim();
      return program.coder.events.decode(cleantLog);
    })
    .find(l => l.name === "orderExecuted");
  if (!log) {
    ctx.body = "OrderExecuted event not emitted in transaction";
    ctx.status = 404;
    return;
  }

  const { data: vaaData } = await connection.getAccountInfo(log.data.vaa);
  const vaa = deserializePostMessage(vaaData);
  const result = {
    emitterChain: vaa.emitterChain,
    emitterAddress: vaa.emitterAddress.toString().replace("0x", ""),
    sequence: vaa.sequence.toString(),
  };

  ctx.body = result;
  ctx.status = 200;
  return;
}

const getProgram = (requestedNetwork: string) => {
  const network = normalizeNetwork(requestedNetwork);
  const programId = matchingEngineProgramId(network);

  const rpc = getSolanaRpc(network);
  const connection = new web3.Connection(rpc);
  const program = new Program<MatchingEngine>(
    { ...(MatchingEngineIDL as any), address: programId },
    { connection },
  );

  return { program, connection, network, programId };
};

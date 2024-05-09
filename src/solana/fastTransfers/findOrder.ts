import { deserializePostMessage } from "@wormhole-foundation/sdk-solana-core";
import { Context, Next } from "koa";
import { FastTransferFindOrderForFillRequest } from "./types.js";
import { buildProgramAndConnection, findExecuteOrderLog } from "./utils.js";

export async function fastTransferFindOrderForFill(ctx: Context, next: Next) {
  const request = { ...ctx.query } as unknown as FastTransferFindOrderForFillRequest;

  if (!request.fillTxHash || !request.network) {
    ctx.body = "Missing parameters, we need to have: fillTxHash, network";
    ctx.status = 400;
    return;
  }

  const { program, connection } = buildProgramAndConnection(request.network);

  const tx = await connection.getTransaction(request.fillTxHash, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    ctx.body = "Fill transaction not found";
    ctx.status = 404;
    return;
  }

  // check that the OrderExecuted event was emitted
  const log = findExecuteOrderLog(program, tx);
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

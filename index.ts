import dotenv from "dotenv";
import Koa from "koa";
import Router from "koa-router";
import cors from "@koa/cors";
import mongoose from "mongoose";

import { Network } from "@wormhole-foundation/connect-sdk";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";
import "@wormhole-foundation/connect-sdk-algorand-tokenbridge";
import { ApiController } from "./src/controller.js";

dotenv.config();

export interface AddressInfoRequest {
  address: string;
  network: Network;
}

export interface InfoRequest {
  address: string;
  amount: string;
  fromChain: string;
  network: Network;
  sequence: string;
  timestamp: string;
  toChain: string;
  tokenAddress: string;
  txHash: string;
}

export interface WrappedAssetRequest {
  network: Network;
  tokenChain: string;
  tokenAddress: string;
  targetChain: string;
  gatewayChain?: string;
}

export interface AlgoAssetRequest {
  network: Network;
  tokenAddress: string;
}

export interface SolanaCctpRequest {
  network: Network;
  txHash: string;
}

const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB correctly");
    return true;
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
    return false;
  }
};

async function runServer() {
  // EXPRESS ENDPOINTS CONNECTIONS
  const app = new Koa();
  const router = new Router();
  const ctrl = new ApiController();
  app.use(cors());

  router.get("/", (ctx, next) => {
    ctx.body = "hey there";
  });

  router.get("/getRedeemTxn", ctrl.getRedeemTx);

  router.get("/getAlgoAssetInfo", ctrl.getAlgoAssetInfo);

  router.get("/getWrappedAsset", ctrl.getWrappedAsset);

  router.get("/getSolanaCctp", ctrl.getSolanaCctp);

  router.get("/getAddressInfo", ctrl.getAdressInfo);

  const port = process.env.NODE_PORT ?? 8080;

  app.use(router.routes()).use(router.allowedMethods());

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

const isConnected = await connectToDatabase();
if (isConnected) {
  runServer();
} else {
  console.log("server wont turn on, no mongodb connection");
}

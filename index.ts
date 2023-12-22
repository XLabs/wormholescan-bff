import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fs from "fs";

import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { ethers } from "ethers";
import { JSONPreset } from "lowdb/node";

import { getChainInfo, getEthersProvider } from "./src/environment";
import { findBlockRangeByTimestamp } from "./src/utils";
import { Network, ChainId, Wormhole, chainIdToChain } from "@wormhole-foundation/connect-sdk";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";

dotenv.config();

interface InfoRequest {
  network: Network;
  chain: string;
  address: string;
  tokenAddress: string;
  timestamp: string;
  amount: string;
  txHash: string;
}

interface IC3Response extends ethers.Log {
  tokenAmount: string;
}

type Data = {
  transactions: Record<string, IC3Response>;
};

interface WrappedAssetRequest {
  network: Network;
  tokenChain: string;
  tokenAddress: string;
  targetChain: string;
}

const initialData: Data = { transactions: {} };
const db = await JSONPreset<Data>("txns.json", initialData);
const { transactions } = db.data;

async function runServer() {
  // EXPRESS ENDPOINTS CONNECTIONS
  const app = express();
  app.use(express.json({ strict: false }));
  app.use(cors());

  app.get("/", (req, res) => {
    res.send("hey there");
  });
  app.get("/status", (req, res) => {
    res.send("hey there");
  });

  app.get("/get_c3_info", async (req, res) => {
    const request = { ...req.query } as unknown as InfoRequest;
    console.log("Request with parameters:", request);

    if (
      !request.network ||
      !request.chain ||
      !request.address ||
      !request.tokenAddress ||
      !request.timestamp ||
      !request.amount ||
      !request.txHash
    ) {
      res.send("Missing parameters, we need to have: network, chain, address, tokenAddress, timestamp, amount");
      return;
    }

    try {
      const { address, chain, network, tokenAddress, timestamp, amount, txHash } = request;

      if (transactions[txHash]) {
        console.log("returning tx already saved");
        res.send(transactions[txHash]);
        return;
      }

      console.log("about to try getting some txn info");

      const ethersProvider = getEthersProvider(getChainInfo(network, +chain as ChainId));
      const blockRanges = await findBlockRangeByTimestamp(ethersProvider!, timestamp);

      if (!blockRanges) {
        res.send("unable to find block range for timestamp");
        return null;
      }

      const transferEventSignature = "Transfer(address,address,uint256)";
      const addressToFilter = ethers.zeroPadValue(ethers.getAddress(address), 32);

      let redeemTxn: IC3Response | null = null;
      let logs: Array<any> = [];

      for (const blockRange of blockRanges) {
        const filter = {
          fromBlock: blockRange[0],
          toBlock: blockRange[1],
          address: tokenAddress,
          topics: [ethers.id(transferEventSignature), null, addressToFilter],
        };

        if (ethersProvider) {
          logs = [...logs, ...(await ethersProvider.getLogs(filter))];
        }
      }

      for (const log of logs) {
        const parsedLog = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], ethers.zeroPadValue(log.data, 32));

        const tokenAmount = BigInt(parsedLog?.[0])?.toString();
        console.log({ tokenAmount });

        if (Math.abs(+tokenAmount - +amount) < 200000) {
          redeemTxn = { ...log, tokenAmount };

          transactions[txHash] = redeemTxn!;
          await db.write();
        }
      }

      console.log("returned:", redeemTxn?.transactionHash);
      res.send(redeemTxn?.transactionHash ? redeemTxn : "");
    } catch (err) {
      console.error("catch!!", err);
      res.send("");
    }
  });

  app.get("/getWrappedAsset", async (req, res) => {
    const request = { ...req.query } as unknown as WrappedAssetRequest;
    console.log("Request with parameters:", request);

    if (!request.tokenChain || !request.tokenAddress || !request.network || !request.targetChain) {
      res.send("Missing parameters, we need to have: tokenChain, tokenAddress, network, targetChain");
      return;
    }

    try {
      const { network, tokenChain, tokenAddress, targetChain } = request;

      const wh = new Wormhole(network.toLowerCase() === "mainnet" ? "Mainnet" : "Testnet", [
        EvmPlatform,
        SolanaPlatform,
        CosmwasmPlatform,
      ]);

      const tokenID = Wormhole.chainAddress(chainIdToChain(+tokenChain as ChainId), tokenAddress);
      const tokenInfo = await wh.getWrappedAsset(chainIdToChain(+targetChain as ChainId), tokenID);

      const tokenList: any = fs.readFileSync("./tokenList.json");
      const parsedTokens = JSON.parse(tokenList);

      const wrappedToken = tokenInfo.address.toString();
      const tokenSymbol = parsedTokens?.[targetChain]?.[wrappedToken.toLowerCase()]?.symbol || "";

      if (wrappedToken) {
        res.send(`FOUND: address ${wrappedToken}${tokenSymbol ? ` with symbol ${tokenSymbol}` : ""}`);
        return;
      }

      res.send("nice request, but nothing found");
    } catch (e) {
      res.send(`error getWrappedAsset: ${e}`);
    }
  });

  const port = process.env.NODE_ENV === "DEV" ? 8080 : 443;
  console.log(process.env.NODE_ENV);
  const server =
    process.env.NODE_ENV === "DEV"
      ? createHttpServer(app)
      : createHttpsServer(
          {
            key: fs.readFileSync("/etc/letsencrypt/live/cryptotruco.com/privkey.pem"),
            cert: fs.readFileSync("/etc/letsencrypt/live/cryptotruco.com/fullchain.pem"),
          },
          app,
        );

  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

runServer();

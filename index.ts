import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fs from "fs";

import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { ChainId, Network } from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import { JSONPreset } from "lowdb/node";

import { getChainInfo, getEthersProvider } from "./src/environment";
import { findBlockRangeByTimestamp } from "./src/utils";

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

interface IC3Response extends ethers.providers.Log {
  tokenAmount: string;
}

type Data = {
  transactions: Record<string, IC3Response>;
};

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
      const blockRanges = await findBlockRangeByTimestamp(ethersProvider, timestamp);

      if (!blockRanges) {
        res.send("unable to find block range for timestamp");
        return null;
      }

      const transferEventSignature = "Transfer(address,address,uint256)";
      const addressToFilter = ethers.utils.hexZeroPad(ethers.utils.getAddress(address), 32);

      let redeemTxn: IC3Response | null = null;
      let logs: Array<any> = [];

      for (const blockRange of blockRanges) {
        const filter = {
          fromBlock: blockRange[0],
          toBlock: blockRange[1],
          address: tokenAddress,
          topics: [ethers.utils.id(transferEventSignature), null, addressToFilter],
        };

        if (ethersProvider) {
          logs = [...logs, ...(await ethersProvider.getLogs(filter))];
        }
      }

      for (const log of logs) {
        const parsedLog = ethers.utils.defaultAbiCoder.decode(["uint256"], ethers.utils.hexZeroPad(log.data, 32));

        const tokenAmount = ethers.BigNumber.from(parsedLog?.[0])?.toString();
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

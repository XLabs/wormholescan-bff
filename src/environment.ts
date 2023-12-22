import { ethers } from "ethers";
import { Chain, ChainId, Network, chainToChainId } from "@wormhole-foundation/connect-sdk";

export const SLOW_FINALITY_CHAINS = [
  chainToChainId("Polygon"),
  chainToChainId("Bsc"),
  chainToChainId("Optimism"),
  chainToChainId("Arbitrum"),
  chainToChainId("Avalanche"),
  chainToChainId("Base"),
  chainToChainId("Celo"),
];

const MAINNET_RPCS: { [key in Chain]?: string } = {
  Acala: "https://eth-rpc-acala.aca-api.network",
  Algorand: "https://mainnet-api.algonode.cloud",
  Aptos: "https://fullnode.mainnet.aptoslabs.com/",
  Arbitrum: "https://arb1.arbitrum.io/rpc",
  Avalanche: "https://rpc.ankr.com/avalanche",
  Base: "https://mainnet.base.org",
  Bsc: "https://bsc-dataseed2.defibit.io",
  Celo: "https://forno.celo.org",
  Ethereum: "https://rpc.ankr.com/eth",
  Fantom: "https://rpc.ankr.com/fantom",
  Injective: "https://api.injective.network",
  Karura: "https://eth-rpc-karura.aca-api.network",
  Klaytn: "https://klaytn-mainnet-rpc.allthatnode.com:8551",
  Moonbeam: "https://rpc.ankr.com/moonbeam",
  Near: "https://rpc.mainnet.near.org",
  Oasis: "https://emerald.oasis.dev",
  Optimism: "https://rpc.ankr.com/optimism",
  Polygon: "https://rpc.ankr.com/polygon",
  Solana: "https://api.mainnet-beta.solana.com",
  Sui: "https://rpc.mainnet.sui.io",
  Terra: "https://terra-classic-fcd.publicnode.com",
  Terra2: "https://phoenix-lcd.terra.dev",
  Xpla: "https://dimension-lcd.xpla.dev",
};

const TESTNET_RPCS: { [key in Chain]?: string } = {
  Arbitrum: "https://goerli-rollup.arbitrum.io/rpc",
  Avalanche: "https://api.avax-test.network/ext/bc/C/rpc",
  Base: "https://goerli.base.org",
  Bsc: "https://data-seed-prebsc-2-s3.binance.org:8545",
  Celo: "https://alfajores-forno.celo-testnet.org",
  Ethereum: "https://rpc.ankr.com/eth_goerli",
  Moonbeam: "https://rpc.api.moonbase.moonbeam.network",
  Optimism: "https://goerli.optimism.io",
  Polygon: "https://rpc.ankr.com/polygon_mumbai",
};

export type Environment = {
  chainInfos: ChainInfo[];
  network: Network;
};

export type ChainInfo = {
  chainId: ChainId;
  evmNetworkId: number;
  chainName: string;
  nativeCurrencyName: string;
  nativeCurrencyDecimals: number;
  relayerContractAddress: string;
  mockIntegrationAddress: string;
  rpcUrl: string;
};

export const testnetEnv: Environment = {
  network: "Testnet",
  chainInfos: [
    {
      chainId: 2 as ChainId,
      evmNetworkId: 5, // https://chainlist.org/chain/5
      chainName: "Ethereum",
      nativeCurrencyName: "ETH",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x28d8f1be96f97c1387e94a53e00eccfb4e75175a",
      mockIntegrationAddress: "",
      rpcUrl: TESTNET_RPCS.Ethereum || "",
    },
    {
      chainId: 4 as ChainId,
      evmNetworkId: 97,
      chainName: "BSC - Testnet",
      nativeCurrencyName: "BNB",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x80aC94316391752A193C1c47E27D382b507c93F3",
      mockIntegrationAddress: "0xb6A04D6672F005787147472Be20d39741929Aa03",
      rpcUrl: TESTNET_RPCS.Bsc || "",
    },
    {
      chainId: 5 as ChainId,
      evmNetworkId: 80001,
      chainName: "Mumbai",
      nativeCurrencyName: "MATIC",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x0591C25ebd0580E0d4F27A82Fc2e24E7489CB5e0",
      mockIntegrationAddress: "0x3bF0c43d88541BBCF92bE508ec41e540FbF28C56",
      rpcUrl: TESTNET_RPCS.Polygon || "",
    },
    {
      chainId: 6 as ChainId,
      evmNetworkId: 43113,
      chainName: "Fuji",
      nativeCurrencyName: "AVAX",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0xA3cF45939bD6260bcFe3D66bc73d60f19e49a8BB",
      mockIntegrationAddress: "0x5E52f3eB0774E5e5f37760BD3Fca64951D8F74Ae",
      rpcUrl: TESTNET_RPCS.Avalanche || "",
    },
    {
      chainId: 14 as ChainId,
      evmNetworkId: 44787,
      chainName: "Celo - Alfajores",
      nativeCurrencyName: "Celo",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x306B68267Deb7c5DfCDa3619E22E9Ca39C374f84",
      mockIntegrationAddress: "0x7f1d8E809aBB3F6Dc9B90F0131C3E8308046E190",
      rpcUrl: TESTNET_RPCS.Celo || "",
    },
    {
      chainId: 16 as ChainId,
      evmNetworkId: 1287,
      chainName: "Moonbase Alpha",
      nativeCurrencyName: "GLMR",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x0591C25ebd0580E0d4F27A82Fc2e24E7489CB5e0",
      mockIntegrationAddress: "0x3bF0c43d88541BBCF92bE508ec41e540FbF28C56",
      rpcUrl: TESTNET_RPCS.Moonbeam || "",
    },
    {
      chainId: 30 as ChainId,
      chainName: "BASE Goerli",
      evmNetworkId: 84531,
      mockIntegrationAddress: "0x9Ee656203B0DC40cc1bA3f4738527779220e3998",
      nativeCurrencyDecimals: 18,
      nativeCurrencyName: "ETH",
      relayerContractAddress: "0xea8029CD7FCAEFFcD1F53686430Db0Fc8ed384E1",
      rpcUrl: TESTNET_RPCS.Base || "",
    },
    {
      chainId: 23 as ChainId,
      chainName: "Arbitrum",
      evmNetworkId: 42161,
      mockIntegrationAddress: "",
      nativeCurrencyDecimals: 18,
      nativeCurrencyName: "ETH",
      rpcUrl: TESTNET_RPCS.Arbitrum || "",
      relayerContractAddress: "0xad753479354283eee1b86c9470c84d42f229ff43",
    },
    {
      chainId: 24 as ChainId,
      chainName: "Optimism",
      evmNetworkId: 10,
      mockIntegrationAddress: "",
      nativeCurrencyDecimals: 18,
      nativeCurrencyName: "Eth",
      relayerContractAddress: "0x01A957A525a5b7A72808bA9D10c389674E459891",
      rpcUrl: TESTNET_RPCS.Optimism || "",
    },
  ],
};

export const mainnetEnv: Environment = {
  network: "Mainnet",
  chainInfos: [
    {
      chainId: 2 as ChainId,
      evmNetworkId: 1,
      chainName: "Ethereum",
      nativeCurrencyName: "ETH",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Ethereum || "",
    },
    {
      chainId: 4 as ChainId,
      evmNetworkId: 56,
      chainName: "BSC",
      nativeCurrencyName: "BNB",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Bsc || "",
    },
    {
      chainId: 5 as ChainId,
      evmNetworkId: 137,
      chainName: "Polygon",
      nativeCurrencyName: "MATIC",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Polygon || "",
    },
    {
      chainId: 6 as ChainId,
      evmNetworkId: 43114,
      chainName: "Avalanche",
      nativeCurrencyName: "AVAX",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Avalanche || "",
    },
    {
      chainId: 10 as ChainId,
      evmNetworkId: 250,
      chainName: "Fantom",
      nativeCurrencyName: "FTM",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Fantom || "",
    },
    {
      chainId: 13 as ChainId,
      evmNetworkId: 8217,
      chainName: "Klaytn",
      nativeCurrencyName: "KLAY",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Klaytn || "",
    },
    {
      chainId: 14 as ChainId,
      evmNetworkId: 42220,
      chainName: "Celo",
      nativeCurrencyName: "Celo",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Celo || "",
    },
    {
      chainId: 16 as ChainId,
      evmNetworkId: 1284,
      chainName: "Moonbeam",
      nativeCurrencyName: "GLMR",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Moonbeam || "",
    },
    {
      chainId: 23 as ChainId,
      evmNetworkId: 42161,
      chainName: "Arbitrum",
      nativeCurrencyName: "ETH",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Arbitrum || "",
    },
    {
      chainId: 24 as ChainId,
      evmNetworkId: 10,
      chainName: "Optimism",
      nativeCurrencyName: "Eth",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Optimism || "",
    },
    {
      chainId: 30 as ChainId,
      evmNetworkId: 8453,
      chainName: "BASE",
      nativeCurrencyName: "ETH",
      nativeCurrencyDecimals: 18,
      relayerContractAddress: "0x706f82e9bb5b0813501714ab5974216704980e31",
      mockIntegrationAddress: "",
      rpcUrl: MAINNET_RPCS.Base || "",
    },
  ],
};

export function getEthersProvider(chainInfo: ChainInfo) {
  if (chainInfo?.rpcUrl) return new ethers.JsonRpcProvider(chainInfo.rpcUrl);

  return null;
}

export function getChainInfo(network: Network, chainId: ChainId): ChainInfo {
  const env = network.toUpperCase() === "MAINNET" ? mainnetEnv : testnetEnv;
  const output = env.chainInfos.find(chainInfo => chainInfo.chainId === chainId);

  if (output === undefined) {
    console.error(`Unknown chainId ${chainId}`);
  }

  return output!;
}

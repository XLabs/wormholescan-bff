## WormholeScan utils

This repository contains an ExpressJS server that provides endpoints that are useful for the Wormhole network.

---

### Endpoints

`/getWrappedAsset`

Tries to get the wrapped token address for a canonical token. Requires the following query parameters:
  - **tokenChain**: original token wormhole chain id
  - **tokenAddress**: original token address
  - **network**: "MAINNET" or "TESTNET"
  - **targetChain**: the wormhole chain id of where that original token is going
 
return example:
```ts
{
  wrappedToken: "c7nnpwuzcnjzbfw5p6jvgsr8pudsrpedp1zahnodwj7h",
  tokenSymbol: "MATICet"
}
```

`/getRedeemTxn`

Tries to get the redeem transaction hash for transactions that don't include it. Requires the following query parameters:
  - **network**: "MAINNET" | "TESTNET"
  - **fromChain**: wormhole chain id of the source chain
  - **toChain**: wormhole chain id of the target chain
  - **address**: target wallet address, the one that should have received the transaction
  - **tokenAddress**: the token address that was sent to this wallet
  - **timestamp**: the date string for this transaction that we want to get
  - **amount**: the raw amount that was received
  - **txHash**: txHash of the source transaction (for cache purposes)
  - **sequence**: sequence of the VAA

return example:
```ts
{
  redeemTxHash: "0xd6e6b693ca820a5455afbf853f5f5ba1c73e9a6149a202a165275ce683637b1d"
}
```

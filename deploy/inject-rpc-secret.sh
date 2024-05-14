#! /bin/sh

kubectl delete secret wormholescan-bff-rpc --ignore-not-found --namespace=wormscan

kubectl create secret generic wormholescan-bff-rpc \
    --from-literal=SOLANA_RPC_URL=${SOLANA_RPC_URL} \
    --namespace=wormscan

kubectl create secret generic wormholescan-bff-rpc \
    --from-literal=SOLANA_DEVNET_RPC_URL=${SOLANA_DEVNET_RPC_URL} \
    --namespace=wormscan

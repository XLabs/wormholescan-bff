#! /bin/sh

kubectl delete secret wormholescan-bff-arkham --ignore-not-found --namespace=wormscan

kubectl create secret generic wormholescan-bff-arkham \
    --from-literal=ARKHAM_API_KEY=${ARKHAM_API_KEY} \
    --namespace=wormscan

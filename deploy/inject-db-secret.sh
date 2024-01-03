#! /bin/sh

kubectl delete secret wormholescan-bff-mongo --ignore-not-found --namespace=wormscan

kubectl create secret generic wormholescan-bff-mongo \
    --from-literal=MONGO_URI=${MONGO_URI} \
    --namespace=wormscan

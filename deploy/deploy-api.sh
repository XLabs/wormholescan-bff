#!/usr/bin/env sh

if [ $# -ne 2 ]; then
    echo "Please specify the tag as the second parameter"
    exit 1
fi

if [[ "$1" == "--staging" ]]; then
    source staging/env.staging.sh
    kubetpl render ./bff.deployment.yaml -s AWS_ACCOUNT="$AWS_ACCOUNT_STAGING" -s TAG="$2" | kubectl apply -f -
    kubectl apply -f bff.service.yaml
elif [[ "$1" == "--production" ]]; then
    source production/env.production.sh
    kubetpl render ./bff.deployment.yaml -s AWS_ACCOUNT="$AWS_ACCOUNT_PRODUCTION" -s TAG="$2" | kubectl apply -f -
    kubectl apply -f bff.service.yaml
else
    echo "Invalid argument. Please use --staging or --production. and the tag as a positional parameter. Example: ./deploy.sh --staging 0.0.1"
fi


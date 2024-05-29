FROM node:20.10.0@sha256:e36ac0440a12839563ad011aabdd3152d6101a9d285126f86b2de5cd7f667712 as node

#### Build App ####
FROM node as build-app
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn
COPY --chown=node:node index.ts tsconfig.json ./
COPY --chown=node:node src/ ./src
RUN yarn build
RUN npx tsx src/updateTokenlist.ts
RUN yarn prettier --write src/tokenList.json
RUN cp src/tokenList.json build/src/
RUN cp src/solana/fastTransfers/idl/matching_engine.json build/src/solana/fastTransfers/idl/
#### END Build App ####

FROM node:lts-alpine3.19@sha256:e96618520c7db4c3e082648678ab72a49b73367b9a1e7884cf75ac30a198e454 as final
WORKDIR /usr/src/app
COPY --chown=node:node package.json yarn.lock ./
RUN yarn --production
COPY --chown=node:node --from=build-app /usr/src/app/build ./
USER node
EXPOSE 8080
CMD ["node", "index.js"]
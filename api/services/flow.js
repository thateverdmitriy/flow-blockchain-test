const fcl = require('@onflow/fcl');
const rlp = require('rlp');
const fs = require('fs');
const path = require('path');
const t = require('@onflow/types');

const { ec } = require('elliptic')
const { SHA3 } = require('sha3')
const { flowConfig } = require('../config/flowConfig.js');

const EC = new ec('p256');

exports.flowConfig = {
  accessApi: process.env.FLOW_ACCESS_API || 'http://127.0.0.1:8080',
  minterAddress: process.env.FLOW_MINTER_ADDRESS || '0xf8d6e0586b0a20c7',
  minterPrivateKeyHex: process.env.FLOW_MINTER_PRIVATE_KEY || '3f4fb3c19d45caeacd0f532c277c4cadad3a1673eb5568421a10e77c7b75c8ab',
  minterAccountKeyIndex: process.env.FLOW_MINTER_ACCOUNT_KEY_INDEX || '0',
  nonFungibleTokenAddress: process.env.FLOW_NON_FUNGIBLE_TOKEN_ADDRESS || '0xf8d6e0586b0a20c7',
};

const nonFungibleTokenPath = '"../../contracts/NonFungibleToken.cdc"';
const momentItemsPath = '"../../contracts/MomentItems.cdc"';

module.exports = class FlowService {

  createAccount = async (auth) => {
    const user = await this.getAccount(flowConfig.minterAddress);
    
    const encodePublicKeys = user.keys.map((pk) =>
      this.encodePublicKeyForFlow(pk.publicKey),
    );

    const CODE = `
    transaction(publicKeys: [String]) {
      prepare(signer: AuthAccount) {
        let acct = AuthAccount(payer: signer)
        for key in publicKeys {
          acct.addPublicKey(key.decodeHex())
        }
      }
    }`;

    console.log(encodePublicKeys)
    return fcl.pipe([
      fcl.invariant(
        encodePublicKeys.length > 0,
        'template({publicKeys}) -- must include one public key when creating an account.',
      ),
      fcl.transaction(CODE),
      fcl.args([fcl.arg(encodePublicKeys, t.Array(t.String))]),
      fcl.proposer(auth),
      fcl.authorizations([auth]),
      fcl.payer(auth),
      fcl.limit(10000)
    ]);
  };

  authMinter = () => {
    return async (account = {}) => {
    const user = await this.getAccount(flowConfig.minterAddress);
    const key = user.keys[flowConfig.minterAccountKeyIndex];

    const sign = this.signWithKey;
    const pk = flowConfig.minterPrivateKeyHex;

    return {
      ...account, // there is some stuff already in here, we need it
      tempId: `${user.address}-${key.index}`,
      addr: fcl.sansPrefix(user.address), // which flow account is going to be doing the signing
      keyId: Number(key.index), // says which key we want to do the signing with
      //publicKeys: user.keys,
      // How to get a signature
      signingFunction: async (signable) => {
        return {
          addr: fcl.withPrefix(user.address), // In this case it should be the same as above
          keyId: Number(key.index), // In this case it should be the same as above
          signature: sign(pk, signable.message),
        };
      },
    };
  };
}

  setupAccount = async (flowAddress = '') => {
    const authorization = await this.authMinter(flowAddress);

    const transaction = fs
      .readFileSync(
        path.join(
          __dirname,
          `../../cadence/transactions/momentItems/setup_account.cdc`,
        ),
        'utf8',
      )
      .replace(
        nonFungibleTokenPath,
        fcl.withPrefix(flowConfig.nonFungibleTokenAddress),
      )
      .replace(momentItemsPath, fcl.withPrefix(flowConfig.minterAddress));

    return this.sendTx({
      transaction,
      args: [],
      authorizations: [authorization],
      payer: authorization,
      proposer: authorization,
    });
  };

  mint = async (recipient, typeID) => {
    const authorization = await this.authMinter();

    const transaction = fs
      .readFileSync(
        path.join(
          __dirname,
          `../../cadence/transactions/momentItems/mint_moment_item.cdc`,
        ),
        'utf8',
      )
      .replace(
        nonFungibleTokenPath,
        fcl.withPrefix(this.nonFungibleTokenAddress),
      )
      .replace(momentItemsPath, fcl.withPrefix(flowConfig.minterAddress));

    return this.sendTx({
      transaction,
      args: [
        fcl.arg(fcl.withPrefix(recipient), t.Address),
        fcl.arg(typeID, t.UInt64),
      ],
      authorizations: [authorization],
      payer: authorization,
      proposer: authorization,
    });
  };

  getAccount = async (addr) => {
    const { account } = await fcl.send([fcl.getAccount(addr)]);
    return account;
  };

  getAddrFromTx = async (tx ) => {
    const { events } = await fcl.tx(tx).onceSealed();
    const accountCreatedEvent = events.find(
      (d ) => d.type === 'flow.AccountCreated',
    );
    this.invariant(accountCreatedEvent, 'No flow.AccountCreated found', events);
    const addr = accountCreatedEvent.data.address?.replace(/^0x/, '');
    this.invariant(addr, 'An address is required');
    return addr;
  };

  getTokenIdFromMintResponse = async (res ) => {
    const { events } = res;
    const mintedEvent = events?.find((d) =>
      d.type.includes('MomentItems.Minted'),
    );
    this.invariant(mintedEvent, 'No flow.MomentMinted found', events);
    const tokenId = mintedEvent.data.id;
    this.invariant(tokenId >= 0, 'A token ID is required');
    return tokenId;
  };

  sendTx = async ({
    transaction,
    args,
    proposer,
    authorizations,
    payer,
  }) => {
    const response = await fcl.send([
      fcl.transaction`
        ${transaction}
      `,
      fcl.args(args),
      fcl.proposer(proposer),
      fcl.authorizations(authorizations),
      fcl.payer(payer),
      fcl.limit(35),
    ]);
    return await fcl.tx(response).onceSealed();
  };

  invariant = (fact, msg, ...rest) => {
    if (!fact) {
      const error = new Error(`INVARIANT ${msg}`);
      error.stack = error.stack
        ?.split('\n')
        .filter((d) => !/at invariant/.test(d))
        .join('\n');
      console.error('\n\n---\n\n', error, '\n\n', ...rest, '\n\n---\n\n');
      throw error;
    }
  };

  signWithKey = (privateKey, msg) => {
    const key = EC.keyFromPrivate(Buffer.from(privateKey, 'hex'));
    const sig = key.sign(this.hashMsg(msg));
    const n = 32;
    const r = sig.r.toArrayLike(Buffer, 'be', n);
    const s = sig.s.toArrayLike(Buffer, 'be', n);
    return Buffer.concat([r, s]).toString('hex');
  };

  hashMsg = (msg) => {
    const sha = new SHA3(256);
    sha.update(Buffer.from(msg, 'hex'));
    return sha.digest();
  };

  encodePublicKeyForFlow = (publicKey) =>
    rlp
      .encode([
        Buffer.from(publicKey, 'hex'), // publicKey hex to binary
        2, // P256 per https://github.com/onflow/flow/blob/master/docs/accounts-and-keys.md#supported-signature--hash-algorithms
        3, // SHA3-256 per https://github.com/onflow/flow/blob/master/docs/accounts-and-keys.md#supported-signature--hash-algorithms
        1000, // give key full weight
      ])
      .toString('hex');
}

exports.flowConfig = {
  accessApi: 'http://127.0.0.1:8080',
  minterAddress: process.env.FLOW_MINTER_ADDRESS ,
  minterPrivateKeyHex: process.env.FLOW_MINTER_PRIVATE_KEY,
  minterAccountKeyIndex: process.env.FLOW_MINTER_ACCOUNT_KEY_INDEX || '0',
  nonFungibleTokenAddress: process.env.FLOW_NON_FUNGIBLE_TOKEN_ADDRESS,
};

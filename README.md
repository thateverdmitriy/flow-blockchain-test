## Development

Install project dependencies with Yarn: `$ yarn`

 ### Run API (with Flow Emulator)

`$ flow emulator`

In a new terminal window, export variables from the emulator:

```sh
$ export FLOW_MINTER_ADDRESS={account}
$ export FLOW_NON_FUNGIBLE_TOKEN_ADDRESS={account}
$ export FLOW_MINTER_PRIVATE_KEY={servicePrivKey}
$ flow project deploy
$ yarn start
```

## Endpoints

### Create new Account

```
    path: "/create",
    method: 'GET'
```

 ### NFT minting

 ```
    path: "/mint",
    method: 'POST',
    body: {
        userFlowAddress: string
    }
```

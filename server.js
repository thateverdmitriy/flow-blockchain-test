const express = require('express');
const fcl = require('@onflow/fcl');
const FlowService = require('./api/services/flow');

const app = express();
const port = process.env.PORT || 3000;
const flow = new FlowService();

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

app.get('/create', async (req, res) => {
    try {
        const authMinter = await flow.authMinter();
        console.log('Auth Minter:', authMinter);

        const tx = await fcl.send([flow.createAccount(authMinter)]);
        console.log('Account creation transaction:', tx);

        flowAccAddress = await flow.getAddrFromTx(tx);
        console.log('New Flow Address', flowAccAddress)

        const setupAccount = await flow.setupAccount(flowAccAddress);
        console.log('Setup account:', acc);

        return res.status(200).json({ setupAccount });
    } catch (err) {
        console.error("Error:", err.message)
        return res.status(400).json({ error: err.message });
    }

});

app.post('/mint', async (req, res) => {
    try {
        const userFlowAddress = req.body.userFlowAddress;
        console.log("userFlowAddress", userFlowAddress)

        const mintRes = await flow.mint(userFlowAddress, 1);
        console.log('Mint response:', mintRes);

        const flowTokenId = await flow.getTokenIdFromMintResponse(mintRes);
        console.log('Flow token ID:', flowTokenId);

        return res.status(200).json({ flowTokenId });
    } catch (err) {
        console.error("Error:", err.message)
        return res.status(400).json({ error: err.message });
    }
});

app.listen(port);

console.log('Flow RESTful API server started on: ' + port);

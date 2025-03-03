require('dotenv').config();
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));

const privateKey = process.env.PRIVATE_KEY;
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

const routerAbi = [
  {
    "inputs": [
      {
        "components": [
          {"internalType": "address","name": "tokenIn","type": "address"},
          {"internalType": "address","name": "tokenOut","type": "address"},
          {"internalType": "uint24","name": "fee","type": "uint24"},
          {"internalType": "address","name": "recipient","type": "address"},
          {"internalType": "uint256","name": "deadline","type": "uint256"},
          {"internalType": "uint256","name": "amountIn","type": "uint256"},
          {"internalType": "uint256","name": "amountOutMinimum","type": "uint256"},
          {"internalType": "uint160","name": "sqrtPriceLimitX96","type": "uint160"}
        ],
        "internalType": "struct ISwapRouter.ExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "exactInputSingle",
    "outputs": [{"internalType": "uint256","name": "amountOut","type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  }
];

const tokenAbi = [
  {"constant": false, "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
  {"constant": true, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
  {"constant": true, "inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"}
];

const router = new web3.eth.Contract(routerAbi, process.env.UNISWAP_ROUTER);
const tokenA = new web3.eth.Contract(tokenAbi, process.env.TOKEN_IN);
const tokenB = new web3.eth.Contract(tokenAbi, process.env.TOKEN_OUT);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoSwap() {
    const amountIn = BigInt(process.env.AMOUNT_IN_WEI);
    const slippage = BigInt(Math.floor(process.env.SLIPPAGE * 100));
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 menit
    const feeTier = 3000; // Sama seperti explorer
    const sqrtPriceLimitX96 = 0; // Tidak ada batas harga
  
    // **Estimasi Amount Out (Manual)**
    let amountOut = amountIn * BigInt("408142036843627") / BigInt("1000000000000000000");
    let amountOutMin = amountOut - (amountOut * slippage / BigInt(10000));
  
    console.log(`💱 Amount Out (estimasi): ${amountOut}`);
    console.log(`📉 Amount Out Min (setelah slippage): ${amountOutMin}`);
  
    // **Cek Approval**
    const allowance = BigInt(await tokenA.methods.allowance(account.address, process.env.UNISWAP_ROUTER).call());
    console.log(`🔄 Allowance: ${allowance}`);
  
    if (allowance < amountIn) {
      console.log("⚠️ Approval token diperlukan...");
      const approveTx = tokenA.methods.approve(process.env.UNISWAP_ROUTER, amountIn);
      await sendTransaction(approveTx, process.env.TOKEN_IN);
      console.log("✅ Token berhasil di-approve!");
    } else {
      console.log("✅ Token sudah di-approve.");
    }
  
    // **Optimasi Gas Fee**
    const gasPrice = BigInt(await web3.eth.getGasPrice());
    const maxPriorityFeePerGas = gasPrice * BigInt(Math.floor(process.env.GAS_MULTIPLIER * 100)) / BigInt(100);
  
    console.log(`⛽ Gas Price: ${gasPrice}, Max Priority Fee Per Gas: ${maxPriorityFeePerGas}`);
  
    // **Delay Random Sebelum Swap (2-5 detik)**
    const delayTime = Math.floor(Math.random() * (5000 - 2000) + 2000);
    console.log(`🕒 Delay sebelum swap: ${delayTime / 1000} detik`);
    await delay(delayTime);
  
    // **Eksekusi Swap (`exactInputSingle`)**
    const swapTx = router.methods.exactInputSingle({
      tokenIn: process.env.TOKEN_IN,
      tokenOut: process.env.TOKEN_OUT,
      fee: feeTier,
      recipient: account.address,
      deadline: deadline,
      amountIn: amountIn.toString(),
      amountOutMinimum: amountOutMin.toString(),
      sqrtPriceLimitX96: sqrtPriceLimitX96
    });
  
    await sendTransaction(swapTx, process.env.UNISWAP_ROUTER, maxPriorityFeePerGas);
    console.log("✅ Swap berhasil!");
  }
  

async function sendTransaction(tx, to, gasPrice = null) {
  const gas = await tx.estimateGas({ from: account.address });
  const finalGasPrice = gasPrice || BigInt(await web3.eth.getGasPrice());

  const signedTx = await web3.eth.accounts.signTransaction(
    {
      to,
      data: tx.encodeABI(),
      gas,
      gasPrice: finalGasPrice.toString()
    },
    privateKey
  );

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log(`📜 Transaction Hash: ${receipt.transactionHash}`);
}

autoSwap().catch(console.error);

import dotenv from 'dotenv';
dotenv.config();
import { noble, keys } from '@cmdcode/crypto-tools'
import { Address, Script, Signer, Tap, Tx } from '@cmdcode/tapscript';
import { AutoPay,getFundingSelectedUtxo,broadcastWithRetries, sleeper } from './utils.js';


function bytesToHex(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}

function hexToBytes(hex) {
    return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
}

function bitLength(number) {
    if (typeof number !== 'bigint') {
      throw new Error("Input must be a BigInt");
    }
    return number === 0n ? 0 : number.toString(2).length;
}

function byteLength(number) {
    if (typeof number !== 'bigint') {
      throw new Error("Input must be a BigInt");
    }
    return Math.ceil(bitLength(number) / 8);
}

function textToHex(text) {
    var encoder = new TextEncoder().encode(text);
    return [...new Uint8Array(encoder)]
            .map(x => x.toString(16).padStart(2, "0"))
            .join("");
}

function charRange(start, stop) {
    var result = [];

    // get all chars from starting char
    // to ending char
    var i = start.charCodeAt(0),
            last = stop.charCodeAt(0) + 1;
    for (i; i < last; i++) {
      result.push(String.fromCharCode(i));
    }

    return result;
}

function toInt26(str) {
    var alpha = charRange('a', 'z');
    var result = 0n;

    // make sure we have a usable string
    str = str.toLowerCase();
    str = str.replace(/[^a-z]/g, '');

    // we're incrementing j and decrementing i
    var j = 0n;
    for (var i = str.length - 1; i > -1; i--) {
      // get letters in reverse
      var char = str[i];

      // get index in alpha and compensate for
      // 0 based array
      var position = BigInt(''+alpha.indexOf(char));
      position++;

      // the power kinda like the 10's or 100's
      // etc... position of the letter
      // when j is 0 it's 1s
      // when j is 1 it's 10s
      // etc...
      const pow = (base, exponent) => base ** exponent;

      var power = pow(26n, j)

      // add the power and index to result
      result += power * position;
      j++;
    }

    return result;
}

function toBytes(number) {
    if (typeof number !== 'bigint') {
      throw new Error("Input must be a BigInt");
    }

    if (number < 0n) {
      throw new Error("BigInt must be non-negative");
    }

    if (number === 0n) {
      return new Uint8Array().buffer;
    }

    const size = byteLength(number);
    const bytes = new Uint8Array(size);
    let x = number;
    for (let i = size - 1; i >= 0; i--) {
      bytes[i] = Number(x & 0xFFn);
      x >>= 8n;
    }

    return bytes.buffer;
}


function createKeyPair(pk = '')
{
  let privkey = "";

  if(pk !== '')
  {
    privkey = pk;
  }
  else
  {
    privkey = bytesToHex(noble.schnorr.utils.randomPrivateKey());
  }

  // console.log('your private key', privkey);

  const keypair = keys.get_keypair(privkey);

  return { seckey: keypair[0], pubkey : keypair[1] }
}


async function mint(SYMBOL, ID, MINT, RECEIVER, RVALUE, TX, VOUT, PVALUE, network, seckey, pubkey)
  {
    const ec = new TextEncoder();

    const [ tseckey ] = Tap.getSecKey(seckey);
    const [ tpubkey ] = Tap.getPubKey(pubkey);

    const address = Address.p2tr.encode(tpubkey, network);
    const toAddress = Address.p2tr.decode(RECEIVER, network).hex;

    const txdata = Tx.create({
      vin  : [{
        txid: TX,
        vout: VOUT,
        prevout: {
          value: PVALUE,
          scriptPubKey: [ 'OP_1', tpubkey ]
        },
      }],
      vout : [{
        value: RVALUE,
        scriptPubKey: [ 'OP_1', toAddress ]
      },
      {
        scriptPubKey: [ 'OP_RETURN', ec.encode('P'), ec.encode('M'), toBytes(toInt26(SYMBOL)), toBytes(BigInt(ID)), toBytes(0n), textToHex(''+MINT) ]
      }
      ]
    })

    const sig = Signer.taproot.sign(tseckey, txdata, 0)
    txdata.vin[0].witness = [ sig ]

    await Signer.taproot.verify(txdata, 0, { throws: true })

    console.log('Send exactly ' + PVALUE + ' sats to address:', address);
    console.log('Your MINT txhex:', Tx.encode(txdata).hex)
}

const RVALUE = 546;
const network = 'main';

async function mintAndChange(SYMBOL, ID, MINT, RECEIVER, UTXO, seckey, pubkey)
{
    // const RVALUE = 546;
    
    const ec = new TextEncoder();

    const [ tseckey ] = Tap.getSecKey(seckey);
    const [ tpubkey ] = Tap.getPubKey(pubkey);

    const address = Address.p2tr.encode(tpubkey, network);
    const toAddress = Address.p2tr.decode(RECEIVER, network).hex;

    let satsbyteStr = process.env.satsbyte || '15';
    let satsbyte = parseInt(satsbyteStr);
    const vsize = 181;//交易大小（1个输入2个输出）
    let fee = vsize * satsbyte;
    let change = UTXO.value - RVALUE - fee;

    // console.log(UTXO.value,fee,change);
    // return;
    const txdata = Tx.create({
      vin  : [{
        txid: UTXO.txId,
        vout: UTXO.vout,
        prevout: {
          value: UTXO.value,
          scriptPubKey: [ 'OP_1', tpubkey ]
        },
      }],
      vout : [{
        value: RVALUE,
        scriptPubKey: [ 'OP_1', toAddress ]
      },
      {
        scriptPubKey: [ 'OP_RETURN', ec.encode('P'), ec.encode('M'), toBytes(toInt26(SYMBOL)), toBytes(BigInt(ID)), toBytes(0n), textToHex(''+MINT) ]
      },
      {
        value: change,
        scriptPubKey: [ 'OP_1', tpubkey ]
      }
      ]
    })

    const sig = Signer.taproot.sign(tseckey, txdata, 0)
    txdata.vin[0].witness = [ sig ]

    await Signer.taproot.verify(txdata, 0, { throws: true })

    // console.log('Your MINT txhex:', Tx.encode(txdata).hex)
    const rawtx = Tx.encode(txdata).hex;
    const txId = Tx.util.getTxid(txdata);
    // console.log('Your MINT txhex:', rawtx,txId);

    console.log(`mint ${SYMBOL}->${RECEIVER}, 手续费:${fee} 余额:${change}`);

    let result = await broadcastWithRetries(rawtx);
    if (!(result)) {
        console.log('Error sending', txId, rawtx);
        throw new Error('Unable to broadcast commit transaction after attempts: ' + txId);
    } else {
        console.log('Success sent tx: ', txId);
    }
}


async function getNextUTXO(address,minFundingSatoshis,lastTxId) {
  let attempts = 0;
  const SEND_RETRY_SLEEP_SECONDS = 10;
  const SEND_RETRY_ATTEMPTS = 10;
  let result = null;
  do {
      try {
          let next = await getFundingSelectedUtxo(address,minFundingSatoshis);
          if (next.txId != lastTxId) {
              result = next;
              break;
          }
          else{
            console.log(`same UTXO,Will retry again in ${SEND_RETRY_SLEEP_SECONDS} seconds...`);
            await sleeper(SEND_RETRY_SLEEP_SECONDS);
          }
      } catch (err) {
          console.log(`network ERROR,Will retry again in ${SEND_RETRY_SLEEP_SECONDS} seconds...`);
          await sleeper(SEND_RETRY_SLEEP_SECONDS);
      }
      attempts++;
  } while (attempts < SEND_RETRY_ATTEMPTS);
  return result;
}

async function multiMint(){
    const privateKey = process.env.privateKey || '';
    if(privateKey == ''){
      console.log('请先配置privateKey');
      return;
    }
    let pair = createKeyPair(privateKey);
    const [ tpubkey ] = Tap.getPubKey(pair.pubkey);
    const address = Address.p2tr.encode(tpubkey, network);
    
    let satsbyteStr = process.env.satsbyte || '15';
    let satsbyte = parseInt(satsbyteStr);
    const vsize = 181;//交易大小（1个输入2个输出）
    let fee = vsize * satsbyte;
    let minFundingSatoshis = RVALUE + fee;

    let mintAmount = process.env.mintAmount || '1000';
    const ID = 0;
    const mintTicker = process.env.mintTicker || '';

    const receiver = process.env.receiver || '';

    if(mintTicker == ''){
      console.log('请先配置TICKER');
      return;
    }
    if(receiver == ''){
      console.log('请先配置receiver');
      return;
    }

    let repeatAmountStr = process.env.repeatAmount || '1';
    let repeatAmount = parseInt(repeatAmountStr);

    let lastTxId = "-1";
    for(let i = 0;i < repeatAmount;i ++){
      // const utxo = await getFundingSelectedUtxo(address,minFundingSatoshis);
      const utxo = await getNextUTXO(address,minFundingSatoshis,lastTxId);
      if(utxo == null){
        console.log(address,'余额不足或频繁取到同一UTXO..');
        break;
      }
      // mintAndChange(mintTicker,ID, mintAmount, receiver,utxo,pair.seckey,pair.pubkey);
      await sleeper(5);
      lastTxId = utxo.txId;
    }
    console.log(`本次mint了${repeatAmount}张..`);
}

multiMint().catch(console.error);

// async function main(){

//     let pair = createKeyPair();

//     let satsbyte = 44;
//     let vsizeSendToken = 138;//把铭文打到目标地址的交易

//     let txFee = (satsbyte - 1) * vsizeSendToken + outPutSats;


//     const [ tpubkey ] = Tap.getPubKey(pair.pubkey);

//     const middleAddress = Address.p2tr.encode(tpubkey, network);

//     console.log('Wait until exactly ' + txFee + ' sats sended to address:', middleAddress);

//     const paymentTxId = await AutoPay(txFee,middleAddress);

//     mint(
//           'SHIBA',               // TICKER
//           0,                    // ID
//           '100000',               // mint amount
//           'bc1p87q79rcq45atdkt3nd9djhpks32zq63wq9hvqqqy84xc2srvg2ks2f4ekl', // beneficiary address (receiver)
//           546,                  // sats in beneficiary output
//           paymentTxId, // tx id of utxo to spend from
//           0,                    // vout (switch to either 0 or 1 if you get an invalid schnorr error)
//           txFee,                // tx fee (must include sats for the beneficiary output)
//           'main',               // signet, testnet, main
//           pair.seckey,
//           pair.pubkey
//       )


//   //createRandomKey
//   //AutoPay
//   //getPayUTXO

//     // let pair = createKeyPair('4f2799618bd7c527069cc5880af4e3f8ec4a5fe3f3bfcddc453dea9b8569bf8b');
//     // mint(
//     //     'SHIBA',               // TICKER
//     //     0,                    // ID
//     //     '100000',               // mint amount
//     //     'bc1p87q79rcq45atdkt3nd9djhpks32zq63wq9hvqqqy84xc2srvg2ks2f4ekl', // beneficiary address (receiver)
//     //     546,                  // sats in beneficiary output
//     //     '59bbc2670b6508e5b61f028a5137701dd319f82244d8cde7b8ccef8b4f741233', // tx id of utxo to spend from
//     //     0,                    // vout (switch to either 0 or 1 if you get an invalid schnorr error)
//     //     6505,                // tx fee (must include sats for the beneficiary output)
//     //     'main',               // signet, testnet, main
//     //     pair.seckey,
//     //     pair.pubkey
//     // )
// }

// main().catch(console.error);
// let pair = createKeyPair('7093e9ff94bcdc1dbf5f94fe8f16bba0746910f5216b378fc31b602117982182');
// const utxo = await getFundingSelectedUtxo('bc1pwhvs30mwa267ylvwxxcy7jtyeym9l3rdrrd5w79cz7azq688etuqpzqgnr',4000);
// mintAndChange(
//         'SHIBA',               // TICKER
//         0,                    // ID
//         '100000',               // mint amount
//         'bc1p87q79rcq45atdkt3nd9djhpks32zq63wq9hvqqqy84xc2srvg2ks2f4ekl', // beneficiary address (receiver)
//         utxo,
//         pair.seckey,
//         pair.pubkey
//     );
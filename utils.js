import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { address as BitcoinAddress, crypto as BitcoinCrypto } from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { initEccLib } from 'bitcoinjs-lib';
initEccLib(ecc);

import * as bitcoin from 'bitcoinjs-lib';

import { ECPairFactory} from 'ecpair';
const ECPair = ECPairFactory(ecc);

import {
    networks,
    Psbt,
} from "bitcoinjs-lib";


const ELECTRUMX_URL = 'https://ep.nextdao.xyz/proxy';
// const ELECTRUMX_URL = 'https://ep.atomicals.xyz/proxy';


export const sleeper = async (seconds) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, seconds * 1000);
    })
}



// Convert BTC address to script hash
function addressToScriptHash(address) {
  const script = BitcoinAddress.toOutputScript(address);
  const hash = BitcoinCrypto.sha256(script);
  const reversedHash = Buffer.from(hash.reverse());
  return reversedHash.toString('hex');
}

async function call(method, params) {
    const response = await axios.post(ELECTRUMX_URL + '/' + method, { params} );
    return response.data.response;
}

export async function getBalance(address){
    const scripthash = addressToScriptHash(address);
    return getBalanceHash(scripthash);
}

export async function getBlockHeight(){
    const p = new Promise((resolve, reject) => {
        call('blockchain.headers.subscribe').then(function (result) {
            resolve(result);
        }).catch((error) => {
            reject(error);
        })

    });
    return p;
}

function getBalanceHash(scripthash){
    const p = new Promise((resolve, reject) => {
        call('blockchain.scripthash.get_balance', [scripthash]).then(function (result) {
            let total = result['confirmed'] + result['unconfirmed']
            total = total / 100000000;
            
            resolve(total);
        }).catch((error) => {
            reject(error);
        })

    });
    return p;
}

export async function getHistory(address){
    const scripthash = addressToScriptHash(address);
    const p = new Promise((resolve, reject) => {
        call('blockchain.scripthash.get_history', [scripthash]).then(function (result) {
            const data = {
                unconfirmed: 0,
                confirmed: 0,
                utxos: []
            };

            for (const utxo of result) {
                if (!utxo.height || utxo.height <= 0) {
                    data.unconfirmed += 1;
                } else {
                    data.confirmed += 1;
                }
                data.utxos.push({
                    txId: utxo.tx_hash,
                })
            }
            resolve(data);
        }).catch((error) => {
            reject(error);
        })

    });
    return p;
}


async function getUnspentAddress(address) {
    const scripthash = addressToScriptHash(address);
    return getUnspentScripthash(scripthash);
}

function getUnspentScripthash(scripthash){
    const p = new Promise((resolve, reject) => {
        call('blockchain.scripthash.listunspent', [scripthash]).then(function (result) {
            const data = {
                unconfirmed: 0,
                confirmed: 0,
                utxos: []
            };

            for (const utxo of result) {
                if (!utxo.height || utxo.height <= 0) {
                    data.unconfirmed += utxo.value;
                } else {
                    data.confirmed += utxo.value;
                }
                data.utxos.push({
                    txid: utxo.tx_hash,
                    txId: utxo.tx_hash,
                    outputIndex: utxo.tx_pos,
                    index: utxo.tx_pos,
                    vout: utxo.tx_pos,
                    value: utxo.value,
                    atomicals: utxo.atomicals,
                })
            }
            resolve(data);
        }).catch((error) => {
            reject(error);
        })

    });
    return p;
}

export const toXOnly = (publicKey) => {
    return publicKey.slice(1, 33);
}

export const getKeypairInfo = (childNode) => {
    const network = networks.bitcoin;
    const childNodeXOnlyPubkey = toXOnly(childNode.publicKey);
    // This is new for taproot
    // Note: we are using mainnet here to get the correct address
    // The output is the same no matter what the network is.
    const { address, output } = bitcoin.payments.p2tr({
      internalPubkey: childNodeXOnlyPubkey,
      network: network
    });
  
    // Used for signing, since the output and address are using a tweaked key
    // We must tweak the signer in the same way.
    const tweakedChildNode = childNode.tweak(
      bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkey),
    );
  
    return {
      address,
      tweakedChildNode,
      childNodeXOnlyPubkey,
      output,
      childNode
    }
  }

export const getFundingSelectedUtxo = async (address, minFundingSatoshis) => {
    // Query for a UTXO
    let listunspents = await getUnspentAddress(address);
    let utxos = listunspents.utxos.filter((utxo) => {
      if (utxo.value >= minFundingSatoshis) {
        return utxo;
      }
    });
    if (!utxos.length) {
      throw new Error(`Unable to select funding utxo, check at least 1 utxo contains ${minFundingSatoshis} satoshis`);
    }
    const selectedUtxo = utxos[0];
    // console.log(selectedUtxo);
    return selectedUtxo;
}

export async function sendTransaction(signedRawtx) {
    const p = new Promise((resolve, reject) => {
        call('blockchain.transaction.broadcast', [signedRawtx]).then(function (result) {
            resolve(result);
        }).catch((error) => {
            console.log('error', error);
            reject(error);
        })
    });
    return p;
}


export async function broadcastWithRetries(rawtx) {
    let attempts = 0;
    const SEND_RETRY_SLEEP_SECONDS = 10;
    const SEND_RETRY_ATTEMPTS = 10;
    let result = null;
    do {
        try {
            // console.log('rawtx', rawtx);
           
            result = await sendTransaction(rawtx);
            if (result) {
                break;
            }
        } catch (err) {
            console.log(`Will retry to broadcast transaction again in ${SEND_RETRY_SLEEP_SECONDS} seconds...`);
            await sleeper(SEND_RETRY_SLEEP_SECONDS)
        }
        attempts++;
    } while (attempts < SEND_RETRY_ATTEMPTS);
    return result;
}

// export async function AutoPay(satsToSend,receiver){

//     const privateKey = process.env.privateKey || '';
//     const keypair = keys.get_keypair(privateKey);

//     let seckey = keypair[0];
//     let pubkey = keypair[1];

//     const [ tseckey ] = Tap.getSecKey(seckey);
//     const [ tpubkey ] = Tap.getPubKey(pubkey);

//     let satsbyteStr = process.env.satsbyte || '15';
//     let satsbyte = parseInt(satsbyteStr);
//     let vsize =  154;//预估的交易大小
//     let fee = vsize * satsbyte;
//     let minFundingSatoshis = satsToSend + fee;

//     let network = process.env.network || 'main';
//     const senderAddress = Address.p2tr.encode(tpubkey, network);
//     const toAddress = Address.p2tr.decode(receiver, network).hex;

//     console.log(senderAddress,'minFundingSatoshis','fee',fee);
//     const utxo = await getFundingSelectedUtxo(senderAddress,minFundingSatoshis);
    
//     console.log('utxo',utxo.txId);

//     let change = utxo.value - satsToSend - fee;

//     const txdata = Tx.create({
//       vin  : [{
//         txid: utxo.txId,
//         vout: utxo.vout,
//         prevout: {
//           value: utxo.value,
//           scriptPubKey: [ 'OP_1', tpubkey ]
//         },
//       }],
//       vout : [{
//         value: satsToSend,
//         scriptPubKey: [ 'OP_1', toAddress ]
//       },
//       {
//         value: change,
//         scriptPubKey: [ 'OP_2', senderAddress.hex ]
//       }
//       ]
//     })

//     const sig = Signer.taproot.sign(tseckey, txdata, 0);
//     txdata.vin[0].witness = [ sig ];

//     await Signer.taproot.verify(txdata, 0, { throws: true });

//     console.log('PAY FEE txhex:', Tx.encode(txdata).hex);

//     const txId = Tx.util.getTxid(txdata);
//     return txId;
// }

async function isSpendByAddress(txid,address){
    const txResult = await getTx(txid);

    if (!txResult || !txResult.success) {
        throw `Transaction not found in getInputUtxoFromTxid ${txid}`;
    }
    const tx = txResult.tx;

    for (const vin of tx.vin) {
        const refTx = await getTx(vin.txid);
  
        const refTransaction = txResult.tx;
        const output = refTransaction.vout[vin.vout];
        if (output.scriptPubKey.addresses.includes(address)) {
          return true; // 该地址发起了交易
        }
      }
    return false; // 该地址没有发起交易
}


export async function getTx(txid, verbose = false) {
    const p = new Promise((resolve, reject) => {
        this.call('blockchain.transaction.get', [txid, verbose ? 1 : 0]).then(function (result) {
            resolve({
                success: true,
                tx: result
            });
        }).catch((error) => {
            reject(error);
        })
    });
    return p;
}

export async function AutoPay(satsToSend,receiver){
    const privateKeyWIF = process.env.privateKeyWIF || '';
    const network = networks.bitcoin;
    const keypairRaw = ECPair.fromWIF(privateKeyWIF,network);
    const keypair = getKeypairInfo(keypairRaw);

    let senderAddress = keypair.address;
    let satsbyteStr = process.env.satsbyte || '15';
    let satsbyte = parseInt(satsbyteStr);
    let vsize = 154;//预估的交易大小
    let fee = vsize * satsbyte;
    let minFundingSatoshis = satsToSend + fee;
    // console.log(satsbyte,fee);
    // return;
    const utxo = await getFundingSelectedUtxo(senderAddress,minFundingSatoshis);

    // const validator = (
    //     pubkey: Buffer,
    //     msghash: Buffer,
    //     signature: Buffer,
    //   ): boolean => ECPair.fromPublicKey(pubkey).verify(msghash, signature);
      

    let psbt = new Psbt({ network: network });
    psbt.setVersion(2);
    psbt.addInput({
        hash: utxo.txid,
        index: utxo.outputIndex,
        witnessUtxo: { value: utxo.value, script: Buffer.from(keypair.output, 'hex') },
        tapInternalKey: keypair.childNodeXOnlyPubkey,
    });

    psbt.addOutput({
        address: receiver,
        value: satsToSend
    });

    //找零
    let change = utxo.value - satsToSend - fee;
    // console.log(senderAddress,satsToSend,fee,change);
    psbt.addOutput({
        address: senderAddress,
        value: change
    });

    console.log(`${senderAddress}->${receiver},发送:${satsToSend} 手续费:${fee} 余额:${change}`);

    psbt.signInput(0, keypair.tweakedChildNode);
    // psbt.validateSignaturesOfInput(0, validator);
    psbt.finalizeAllInputs();

    const interTx = psbt.extractTransaction();
    const rawtx = interTx.toHex();
    // console.log(interTx.getId());
    // console.log(rawtx);

    // if (!(await broadcastWithRetries(rawtx))) {
    //     console.log('Error sending', interTx.getId(), rawtx);
    //     throw new Error('自动支付失败！Unable to broadcast commit transaction after attempts: ' + interTx.getId());
    // } else {
    //     console.log('自动支付 Success sent tx: ', interTx.getId());
    // }
}




// AutoPay(5000,'bc1pwhvs30mwa267ylvwxxcy7jtyeym9l3rdrrd5w79cz7azq688etuqpzqgnr');

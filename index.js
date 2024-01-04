import fs from 'fs';
import { getBalance,getHistory,getBlockHeight } from './utils.js';
import { sleeper } from './utils.js';
import { FundingDB } from './dataBase.js';
import axios from 'axios';


const addressData = JSON.parse(fs.readFileSync('address.json', 'utf8'));
const addresses = addressData.total_addresses;
const addressNames = addressData.address_names;

const fundingDb = new FundingDB();
let btcPrice = 38000;


function toUTC8String(date) {
    // 将日期转换为 UTC+8
    const utc8Offset = 8;
    const utcDate = new Date(date.getTime() + utc8Offset * 60 * 60 * 1000);

    // 格式化日期和时间
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    const hour = String(utcDate.getUTCHours()).padStart(2, '0');
    const minute = String(utcDate.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}`;
}


async function main() { 
    btcPrice = await getBitcoinPrice();
    let totalBalance = 0;
    // const date = new Date().toISOString().split('T')[0];
    const date = new Date();
    const dateTime = toUTC8String(date);
    // const dateISO = date.toISOString().split('T');
    // const formattedDate = dateISO[0];
    // const formattedTime = dateISO[1].split(':')[0] + ':' + dateISO[1].split(':')[1];
    // const dateTime = formattedDate + ' ' + formattedTime;
    // console.log(dateTime); // 输出格式为 "YYYY-MM-DD HH:MM"


    const totalLen = addresses.length;
    let queryIndex = 0;
    let total_diff_balance = 0;

    while(queryIndex < totalLen){
        let address = addresses[queryIndex];
        try{
            const balance = await getBalance(address);
            console.log(`Balance for ${address}: ${balance} BTC`);
            totalBalance += balance;
            
            const latestRecord = await fundingDb.getLatestBalanceInfo(address);
            //跟上次记录有变化，添加差异记录
            if (!latestRecord || latestRecord.balance !== balance) {
                let balance_diff = latestRecord ? balance - latestRecord.balance : balance;
                fundingDb.insertBalanceDifference(address,dateTime,balance_diff);

                total_diff_balance += balance_diff;
            }
            fundingDb.insertBalance(address,dateTime, balance,Number(balance * btcPrice).toFixed(4),addressNames[queryIndex]);

            queryIndex ++;
            await sleeper(3);
        }catch(error){
            console.log(error);
            console.log('查询出错，等10s..');
            await sleeper(10);
        }
    }
    console.log('totalbalance',totalBalance);
    fundingDb.insertBalance('balance summary', dateTime,totalBalance,Number(totalBalance * btcPrice).toFixed(4));
    fundingDb.insertBalanceDifference("diffenence summary",dateTime, total_diff_balance);
}

async function getBitcoinPrice() {
    try {
        const url = 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD';
        const response = await axios.get(url);
        const price = response.data.USD;
        console.log(`Bitcoin Price: $${price}`);
        return price;
    } catch (error) {
        console.error('Error fetching Bitcoin price:', error);
        return 43000;
    }
}

async function getTransationCount() { 
    let totalBalance = 0;
    const date = new Date();
    const dateTime = toUTC8String(date);
    console.log(dateTime); // 输出格式为 "YYYY-MM-DD HH:MM"


    const totalLen = addresses.length;
    let queryIndex = 0;

    while(queryIndex < totalLen){
        let address = addresses[queryIndex];
        try{
            const history = await getHistory(address);
            console.log(`Hystory record ${address}: ${history.utxos.length}`);
            fundingDb.insertHistory(dateTime, address, history.utxos.length);
            await sleeper(3);
            queryIndex ++;
        }catch(error){
            console.log(error);
            console.log('查询出错，等10s..');
            await sleeper(10);
        }
    }
}

main().catch(console.error);
// getTransationCount();
// let res = await getBlockHeight();
// console.log(res);
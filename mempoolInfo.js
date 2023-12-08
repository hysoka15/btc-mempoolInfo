import fs from 'fs';
import { getBalance,getHistory } from './utils.js';
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
    btcPrice = await getBitcoinPriceMempool();
    console.log('current Price',btcPrice);
    let totalBalance = 0;
    const date = new Date();
    const dateTime = toUTC8String(date);

    const totalLen = addresses.length;
    let queryIndex = 0;
    let totalSpentTXO = 0;
    let total_diff_balance = 0;
    let total_diff_funded = 0;
    let total_diff_spent = 0;

    while(queryIndex < totalLen){
        let address = addresses[queryIndex];
        try{
            let response = await getAddressInfo(address);
            console.log(`查询第${queryIndex}个`);
            let funded_txo_count = response['chain_stats']['funded_txo_count'] + response['mempool_stats']['funded_txo_count'];
            let funded_txo_sum = response['chain_stats']['funded_txo_sum'] + response['mempool_stats']['funded_txo_sum'];
            let spent_txo_count = response['chain_stats']['spent_txo_count'] + response['mempool_stats']['spent_txo_count'];
            let spent_txo_sum = response['chain_stats']['spent_txo_sum'] + response['mempool_stats']['spent_txo_sum'];
            let tx_count = response['chain_stats']['tx_count'] + response['mempool_stats']['tx_count'];
            let balance = funded_txo_sum - spent_txo_sum;
            balance /= 100000000;

            totalBalance += balance;
            totalSpentTXO += spent_txo_count;
      
            const latestRecord = await fundingDb.getLatestAddressInfo(address);
            //跟上次记录有变化，添加差异记录
            if (!latestRecord || latestRecord.spent_txo_count !== spent_txo_count || latestRecord.balance !== balance || latestRecord.funded_txo_count != funded_txo_count) {
                let spend_txo_diff = latestRecord ? spent_txo_count - latestRecord.spent_txo_count : spent_txo_count;
                let balance_diff = latestRecord ? balance - latestRecord.balance : balance;
                let funded_txo_count_diff = (latestRecord && latestRecord.funded_txo_count) ? funded_txo_count - latestRecord.funded_txo_count : 0;
                let spend_unit = balance_diff < 0 ? balance_diff / spend_txo_diff : 0;
                let funded_unit = balance_diff > 0 ? balance_diff / funded_txo_count_diff : 0;
                let spend_unit_usd = Number(spend_unit * btcPrice).toFixed(4);
                let funded_unit_usd = Number(funded_unit * btcPrice).toFixed(4);
                fundingDb.insertDifferenceInfo(address,dateTime, spend_txo_diff,funded_txo_count_diff,balance_diff,spend_unit,funded_unit,btcPrice,spend_unit_usd,funded_unit_usd);

                total_diff_balance += balance_diff;
                total_diff_funded += funded_txo_count_diff;
                total_diff_spent += funded_txo_count_diff;
            }

            let balance_in_usd = Number(balance * btcPrice).toFixed(4);
            fundingDb.insertAddressInfo(address,dateTime,spent_txo_count,funded_txo_count, balance,balance_in_usd,addressNames[queryIndex]);

            queryIndex ++;
            await sleeper(3);
        }catch(error){
            console.log(error);
            console.log('查询出错，等10s..');
            await sleeper(10);
        }
    }
    console.log('totalbalance',totalBalance,"totalSpentTXO",totalSpentTXO);
    fundingDb.insertSummary(dateTime, totalSpentTXO,totalBalance,Number(totalBalance * btcPrice).toFixed(4));

    //总结差异
    let sum_spend_unit = total_diff_balance < 0 ? total_diff_balance / total_diff_spent : 0;
    let sum_funded_unit = total_diff_balance > 0 ? total_diff_balance / total_diff_funded : 0;
    let sum_spend_unit_usd = Number(sum_spend_unit * btcPrice).toFixed(4);
    let sum_funded_unit_usd = Number(sum_funded_unit * btcPrice).toFixed(4);

    fundingDb.insertDifferenceInfo(dateTime + " summary",dateTime, total_diff_spent,total_diff_funded,total_diff_balance,sum_spend_unit,sum_funded_unit,btcPrice,sum_spend_unit_usd,sum_funded_unit_usd);
}

async function getAddressInfo(address) {
    try {
        const response = await axios.get(`https://mempool.space/api/address/${address}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching address data:', error);
        return null;
    }
}

async function getBitcoinPriceMempool() {
    try {
        const response = await axios.get('https://mempool.space/api/v1/historical-price');
        return response.data.prices[0].USD;
    } catch (error) {
        console.error('Error fetching Bitcoin price from CoinGecko:', error);
        return null;
    }
}

main().catch(console.error);
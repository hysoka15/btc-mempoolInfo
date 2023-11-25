import fs from 'fs';
import { getBalance,getHistory } from './utils.js';
import { sleeper } from './utils.js';
import { FundingDB } from './dataBase.js';
import axios from 'axios';


const addressData = JSON.parse(fs.readFileSync('address.json', 'utf8'));
const addresses = addressData.total_addresses;

const fundingDb = new FundingDB();


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
    let totalBalance = 0;
    const date = new Date();
    const dateTime = toUTC8String(date);

    const totalLen = addresses.length;
    let queryIndex = 0;
    let totalSpentTXO = 0;

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
            // address,date, spent_txo_count,balance
            fundingDb.insertAddressInfo(address,dateTime,spent_txo_count, balance);
            queryIndex ++;
            await sleeper(3);
        }catch(error){
            console.log(error);
            console.log('查询出错，等10s..');
            await sleeper(10);
        }
    }
    console.log('totalbalance',totalBalance,"totalSpentTXO",totalSpentTXO);
    fundingDb.insertSummary(dateTime, totalSpentTXO,totalBalance);
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

main().catch(console.error);
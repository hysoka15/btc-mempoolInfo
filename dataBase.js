import sqlite3 from 'sqlite3';

const { verbose } = sqlite3;
const db = new (verbose().Database)('./funding.db');

export class FundingDB {
    constructor(){
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS balances (
                address TEXT NOT NULL,
                date TEXT NOT NULL,
                balance INTEGER NOT NULL,
                balance_in_usd INTEGER,
                note TEXT
              )`);
        });

        db.run(`CREATE TABLE IF NOT EXISTS balance_difference (
          address TEXT NOT NULL,
          date TEXT NOT NULL,
          balance_diff INTEGER NOT NULL,
          note TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS address_info (
          address TEXT NOT NULL,
          date TEXT NOT NULL,
          spent_txo_count INTEGER NOT NULL,
          funded_txo_count INTEGER NOT NULL,
          balance INTEGER NOT NULL,
          balance_in_usd INTEGER,
          note TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS summary_info (
          date TEXT NOT NULL,
          total_spent_txo INTEGER NOT NULL,
            total_balance INTEGER NOT NULL,
            balance_in_usd INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS different_info (
          address TEXT NOT NULL,
          date TEXT NOT NULL,
          spend_txo_diff INTEGER NOT NULL,
          funded_txo_count_diff INTEGER NOT NULL,
          balance_diff INTEGER NOT NULL,
          spend_unit INTEGER NOT NULL,
          funded_unit INTEGER NOT NULL,
          current_btc_price INTEGER,
          spend_unit_usd INTEGER NOT NULL,
          funded_unit_usd INTEGER NOT NULL,
          note TEXT
        )`);
    }

    insertHistory(date, address, history) {
      const sql = `INSERT INTO history_amount (address, date, tx_amount) VALUES (?, ?, ?)`;
      db.run(sql, [address, date,  history], (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log(`${address}  inserted`);
      });
    }

    insertBalance( address,date, balance,balance_in_usd,note) {
        const sql = `INSERT INTO balances (address, date, balance,balance_in_usd,note) VALUES (?, ?, ?,?,?)`;
        db.run(sql, [address, date,  balance,balance_in_usd,note], (err) => {
          if (err) {
            return console.error(err.message);
          }
          console.log(`${address}  inserted`);
        });
    }

    async getLatestBalanceInfo(address) {
      return new Promise((resolve, reject) => {
        const query = `SELECT * FROM balances WHERE address = ? ORDER BY date DESC LIMIT 1`;
        db.get(query, [address], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    }

    insertBalanceDifference(address,date,balance_diff) {
      const sql = `INSERT INTO balance_difference (address,date, balance_diff) VALUES (?, ?, ?)`;
      db.run(sql, [address,date,balance_diff], (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log(`${address}  difference inserted..`);
      });
    }

    insertTotalBalance(date, totalBalance) {
        const sql = `INSERT INTO total_balances (date, total_balance) VALUES (?, ?)`;
        db.run(sql, [date, totalBalance], (err) => {
          if (err) {
            return console.error(err.message);
          }
          console.log(`Total balance row has been inserted for ${date}`);
        });
    }

    insertAddressInfo(address,date, spent_txo_count,funded_txo_count,balance,balance_in_usd,note) {
      const sql = `INSERT INTO address_info (address, date,spent_txo_count, funded_txo_count,balance,balance_in_usd,note) VALUES (?, ?, ?, ?,?,?,?)`;
      db.run(sql, [address, date, spent_txo_count,funded_txo_count, balance,balance_in_usd,note], (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log(`${address} balance inserted`);
      });
    }

    insertSummary(date, total_spent_txo,total_balance,balance_in_usd) {
      const sql = `INSERT INTO summary_info (date,total_spent_txo, total_balance,balance_in_usd) VALUES (?,?, ?,?)`;
        db.run(sql, [date, total_spent_txo,total_balance,balance_in_usd], (err) => {
          if (err) {
            return console.error(err.message);
          }
          console.log(`summary_info has been inserted for ${date}`);
        });
    }

    async getLatestAddressInfo(address) {
      return new Promise((resolve, reject) => {
        const query = `SELECT * FROM address_info WHERE address = ? ORDER BY date DESC LIMIT 1`;
        db.get(query, [address], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    }

    // address TEXT NOT NULL,
    //       date TEXT NOT NULL,
    //       spend_txo_diff INTEGER NOT NULL,
    //       funded_txo_count_diff INTEGER NOT NULL,
    //       balance_diff INTEGER NOT NULL,
    //       spend_unit INTEGER NOT NULL,
    //       current_btc_price INTEGER NOT NULL,
          // spend_unit_usd INTEGER NOT NULL,
          // funded_unit_usd INTEGER NOT NULL,
    //       note TEXT
    insertDifferenceInfo(address,date, spend_txo_diff,funded_txo_count_diff,balance_diff,spend_unit,funded_unit,current_btc_price,spend_unit_usd,funded_unit_usd) {
      const sql = `INSERT INTO different_info (address,date, spend_txo_diff,funded_txo_count_diff,balance_diff,spend_unit,funded_unit,current_btc_price,spend_unit_usd,funded_unit_usd) VALUES (?, ?, ?, ?,?, ?, ?, ?,?,?)`;
      db.run(sql, [address,date, spend_txo_diff,funded_txo_count_diff,balance_diff,spend_unit,funded_unit,current_btc_price,spend_unit_usd,funded_unit_usd], (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log(`${address}  difference inserted..`);
      });
    }
    
    
}

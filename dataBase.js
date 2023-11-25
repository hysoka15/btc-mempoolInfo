import sqlite3 from 'sqlite3';

const { verbose } = sqlite3;
const db = new (verbose().Database)('./funding.db');

export class FundingDB {
    constructor(){
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS balances (
                address TEXT NOT NULL,
                date TEXT NOT NULL,
                balance INTEGER NOT NULL
              )`);
        });
        db.run(`CREATE TABLE IF NOT EXISTS total_balances (
            date TEXT NOT NULL,
            total_balance INTEGER NOT NULL
          )`);

        db.run(`CREATE TABLE IF NOT EXISTS history_amount (
          address TEXT NOT NULL,
          date TEXT NOT NULL,
          tx_amount INTEGER NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS address_info (
          address TEXT NOT NULL,
          date TEXT NOT NULL,
          spent_txo_count INTEGER NOT NULL,
          balance INTEGER NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS summary_info (
          date TEXT NOT NULL,
          total_spent_txo INTEGER NOT NULL,
            total_balance INTEGER NOT NULL
        )`);
    }

    insertAddressInfo(address,date, spent_txo_count,balance) {
      const sql = `INSERT INTO address_info (address, date,spent_txo_count, balance) VALUES (?, ?, ?, ?)`;
      db.run(sql, [address, date, spent_txo_count, balance], (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log(`${address}  inserted`);
      });
    }

    insertSummary(date, total_spent_txo,total_balance) {
      const sql = `INSERT INTO summary_info (date,total_spent_txo, total_balance) VALUES (?,?, ?)`;
        db.run(sql, [date, total_spent_txo,total_balance], (err) => {
          if (err) {
            return console.error(err.message);
          }
          console.log(`summary_info has been inserted for ${date}`);
        });
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

    insertBalance(date, address, balance) {
        const sql = `INSERT INTO balances (address, date, balance) VALUES (?, ?, ?)`;
        db.run(sql, [address, date,  balance], (err) => {
          if (err) {
            return console.error(err.message);
          }
          console.log(`${address}  inserted`);
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
}

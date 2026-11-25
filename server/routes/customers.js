import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Return customer details without exposing stored passwords.
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT Customer_ID AS id, Name AS name, DOB AS dob, Phone_Number AS phone, Portfolio_ID AS portfolioId FROM CUSTOMER ORDER BY Customer_ID');
    res.json(rows);
  } catch (err) { next(err); }
});

// Create a customer and their initially empty portfolio in one transaction.
router.post('/', async (req, res, next) => {
  const { name, dob, phone, password } = req.body;
  if (!name || !dob || !phone || !password) return res.status(400).json({ error: 'name, dob, phone, and password are required' });
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [[ids]] = await conn.query('SELECT COALESCE(MAX(Portfolio_ID), 3000) + 1 AS portfolioId FROM PORTFOLIO');
    const [[customers]] = await conn.query('SELECT COALESCE(MAX(Customer_ID), 6000) + 1 AS customerId FROM CUSTOMER');
    await conn.execute('INSERT INTO PORTFOLIO (Portfolio_ID, Amount_Invested, Profit_Loss) VALUES (?, 0, 0)', [ids.portfolioId]);
    await conn.execute('INSERT INTO CUSTOMER (Customer_ID, Password, Name, DOB, Phone_Number, Portfolio_ID) VALUES (?, ?, ?, ?, ?, ?)', [customers.customerId, password, name, dob, phone, ids.portfolioId]);
    await conn.commit();
    res.status(201).json({ id: customers.customerId, portfolioId: ids.portfolioId, name, dob, phone });
  } catch (err) { if (conn) await conn.rollback(); next(err); }
  finally { conn?.release(); }
});

export default router;

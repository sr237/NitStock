import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Return a customer's current stock quantities and latest displayed prices.
router.get('/:customerId', async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT c.Portfolio_ID AS portfolioId, o.Ticker_Code AS ticker, co.Company_Name AS company,
              SUM(g.Alloted) AS quantity, t.Close_Day AS price
       FROM CUSTOMER c JOIN OWNS o ON o.Portfolio_ID = c.Portfolio_ID
       JOIN GOES g ON g.Portfolio_ID = o.Portfolio_ID AND g.Ticker_Code = o.Ticker_Code
       JOIN STOCK s ON s.Ticker_Code = o.Ticker_Code JOIN COMPANY co ON co.Corporate_ID = s.Corporate_ID
       LEFT JOIN TECHNICALS t ON t.Ticker_Code = o.Ticker_Code
       WHERE c.Customer_ID = ? GROUP BY c.Portfolio_ID, o.Ticker_Code, co.Company_Name, t.Close_Day
       ORDER BY co.Company_Name, o.Ticker_Code`, [req.params.customerId]);
    res.json(rows);
  } catch (err) { next(err); }
});

// Buy shares by recording a new lot in the existing LISTINGS and GOES tables.
router.post('/', async (req, res, next) => {
  const { customerId, ticker, quantity } = req.body;
  const qty = Number(quantity);
  if (!customerId || !ticker || !Number.isSafeInteger(qty) || qty <= 0) return res.status(400).json({ error: 'customerId, ticker, and a positive integer quantity are required' });
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [[owner]] = await conn.execute('SELECT Portfolio_ID FROM CUSTOMER WHERE Customer_ID = ?', [customerId]);
    const [[stock]] = await conn.execute('SELECT t.Close_Day AS price FROM STOCK s JOIN TECHNICALS t ON t.Ticker_Code = s.Ticker_Code WHERE s.Ticker_Code = ?', [ticker]);
    if (!owner || !stock) { await conn.rollback(); return res.status(404).json({ error: 'Customer or stock not found' }); }
    const [[lot]] = await conn.execute('SELECT COALESCE(MAX(Listing_No), 0) + 1 AS listingNo FROM LISTINGS WHERE Ticker_Code = ?', [ticker]);
    await conn.execute('INSERT INTO LISTINGS (Listing_No, Price, Time, Ticker_Code, Quantity) VALUES (?, ?, CURRENT_DATE, ?, ?)', [lot.listingNo, stock.price, ticker, qty]);
    await conn.execute('INSERT INTO OWNS (Portfolio_ID, Ticker_Code) VALUES (?, ?) ON DUPLICATE KEY UPDATE Ticker_Code = VALUES(Ticker_Code)', [owner.Portfolio_ID, ticker]);
    await conn.execute('INSERT INTO GOES (Portfolio_ID, Listing_No, Ticker_Code, Alloted) VALUES (?, ?, ?, ?)', [owner.Portfolio_ID, lot.listingNo, ticker, qty]);
    await conn.execute('UPDATE PORTFOLIO SET Amount_Invested = Amount_Invested + ? WHERE Portfolio_ID = ?', [Number(stock.price) * qty, owner.Portfolio_ID]);
    await conn.commit();
    res.status(201).json({ portfolioId: owner.Portfolio_ID, ticker, quantity: qty, price: stock.price });
  } catch (err) { if (conn) await conn.rollback(); next(err); }
  finally { conn?.release(); }
});

// Sell a quantity from the customer's lots, consuming the oldest lots first.
router.delete('/:id', async (req, res, next) => {
  const { customerId, ticker, quantity } = req.body;
  const qty = Number(quantity);
  if (!customerId || !ticker || !Number.isSafeInteger(qty) || qty <= 0) return res.status(400).json({ error: 'customerId, ticker, and a positive integer quantity are required' });
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [[customer]] = await conn.execute('SELECT Portfolio_ID FROM CUSTOMER WHERE Customer_ID = ?', [customerId]);
    if (!customer) { await conn.rollback(); return res.status(404).json({ error: 'Customer not found' }); }
    const [lots] = await conn.execute('SELECT Listing_No, Alloted FROM GOES WHERE Portfolio_ID = ? AND Ticker_Code = ? ORDER BY Listing_No FOR UPDATE', [customer.Portfolio_ID, req.params.id]);
    const total = lots.reduce((sum, lot) => sum + Number(lot.Alloted), 0);
    if (req.params.id !== ticker) { await conn.rollback(); return res.status(400).json({ error: 'Ticker path must match ticker in request body' }); }
    if (total < qty) { await conn.rollback(); return res.status(400).json({ error: 'Not enough shares to sell' }); }
    let remaining = qty;
    for (const lot of lots) {
      const available = Number(lot.Alloted);
      const sold = Math.min(available, remaining);
      if (sold === available) await conn.execute('DELETE FROM GOES WHERE Portfolio_ID = ? AND Listing_No = ? AND Ticker_Code = ?', [customer.Portfolio_ID, lot.Listing_No, ticker]);
      else await conn.execute('UPDATE GOES SET Alloted = Alloted - ? WHERE Portfolio_ID = ? AND Listing_No = ? AND Ticker_Code = ?', [sold, customer.Portfolio_ID, lot.Listing_No, ticker]);
      remaining -= sold;
      if (!remaining) break;
    }
    const [[left]] = await conn.execute('SELECT COUNT(*) AS count FROM GOES WHERE Portfolio_ID = ? AND Ticker_Code = ?', [customer.Portfolio_ID, ticker]);
    if (!left.count) await conn.execute('DELETE FROM OWNS WHERE Portfolio_ID = ? AND Ticker_Code = ?', [customer.Portfolio_ID, ticker]);
    await conn.execute('UPDATE PORTFOLIO SET Amount_Invested = GREATEST(0, Amount_Invested - ?) WHERE Portfolio_ID = ?', [qty, customer.Portfolio_ID]);
    await conn.commit();
    res.json({ portfolioId: customer.Portfolio_ID, ticker, quantitySold: qty });
  } catch (err) { if (conn) await conn.rollback(); next(err); }
  finally { conn?.release(); }
});

export default router;

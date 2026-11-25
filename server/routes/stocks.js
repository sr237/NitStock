import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List stocks with optional company-name search and sector filter.
router.get('/', async (req, res, next) => {
  try {
    const { search = '', sector = '' } = req.query;
    const [rows] = await db.execute(
      `SELECT s.Ticker_Code AS ticker, c.Company_Name AS company, c.Sector_Name AS sector,
              t.Close_Day AS price, GROUP_CONCAT(DISTINCT sli.Listed_In ORDER BY sli.Listed_In) AS exchanges
       FROM STOCK s JOIN COMPANY c ON c.Corporate_ID = s.Corporate_ID
       LEFT JOIN TECHNICALS t ON t.Ticker_Code = s.Ticker_Code
       LEFT JOIN STOCK_LISTED_IN sli ON sli.Ticker_Code = s.Ticker_Code
       WHERE c.Company_Name LIKE ? AND c.Sector_Name LIKE ?
       GROUP BY s.Ticker_Code, c.Company_Name, c.Sector_Name, t.Close_Day
       ORDER BY c.Company_Name, s.Ticker_Code`, [`%${search}%`, sector ? sector : '%']);
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;

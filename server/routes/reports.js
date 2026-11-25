import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Report stocks ranked by holder count using the existing queries.sql report.
router.get('/top-stocks', async (_req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT s.Ticker_Code AS ticker, c.Company_Name AS company, COUNT(o.Portfolio_ID) AS holders
       FROM STOCK s JOIN OWNS o ON o.Ticker_Code = s.Ticker_Code
       JOIN COMPANY c ON c.Corporate_ID = s.Corporate_ID
       GROUP BY s.Ticker_Code, c.Company_Name ORDER BY holders DESC, s.Ticker_Code LIMIT 5`);
    res.json(rows);
  } catch (err) { next(err); }
});

// Summarize each sector's companies, stocks, and stored market capitalization.
router.get('/sector-summary', async (_req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT se.Sector_Name AS sector, se.Sector_Market_Cap AS marketCap,
              COUNT(DISTINCT c.Corporate_ID) AS companies, COUNT(DISTINCT s.Ticker_Code) AS stocks
       FROM SECTOR se LEFT JOIN COMPANY c ON c.Sector_Name = se.Sector_Name
       LEFT JOIN STOCK s ON s.Corporate_ID = c.Corporate_ID
       GROUP BY se.Sector_Name, se.Sector_Market_Cap ORDER BY se.Sector_Name`);
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;

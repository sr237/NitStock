import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import stocks from './routes/stocks.js';
import customers from './routes/customers.js';
import portfolio from './routes/portfolio.js';
import reports from './routes/reports.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/stocks', stocks);
app.use('/api/customers', customers);
app.use('/api/portfolio', portfolio);
app.use('/api/reports', reports);

// Return a readable error for API and database failures.
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Server error' });
});

// Start the API server on the configured port.
app.listen(process.env.PORT || 5000, () => console.log(`NitStock API running on port ${process.env.PORT || 5000}`));

# NitStock

A small React and Express app for browsing the stock market database, customers, portfolios, and reports. It uses the existing MySQL schema in `create.sql`; no schema changes are needed.

# Database setup

1. Install and start MySQL Server.
2. Open `create.sql` in MySQL Workbench or run it from the MySQL command line. It creates and seeds the `STOCK_MARKET` database. The script starts with `DROP TABLE` statements, so use it only when you are comfortable recreating the project tables and seed data.

# Run the server

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Edit `server/.env` with your local MySQL user and password, then start the API:

```powershell
npm run dev
```

The API runs at `http://localhost:5000`. Available routes include `GET /api/stocks?search=TCS&sector=IT`, `GET/POST /api/customers`, `GET /api/portfolio/:customerId`, `POST /api/portfolio`, `DELETE /api/portfolio/:ticker`, and the two report routes under `/api/reports`.

## Run the client

In another terminal:

```powershell
cd client
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The client sends API requests to `http://localhost:5000/api` by default. Set `VITE_API_URL` in a client `.env` file if the API uses a different address.

## Notes

- Customer records require a password because the existing `CUSTOMER.Password` column is required. This first version has no login flow.
- Buys are stored as lots in the existing `LISTINGS` and `GOES` tables, with ownership tracked in `OWNS`. Prices use `TECHNICALS.Close_Day`.
- Top stocks reuses the highest-holder-count query pattern from `queries.sql`; sector summary reports stored sector market cap plus company and stock counts.

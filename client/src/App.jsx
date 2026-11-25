import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import api from './api.js';

// Render a consistent page title, navigation, and route content.
export default function App() {
  return <><header><Link className="brand" to="/">NitStock</Link><nav><NavLink to="/">Stocks</NavLink><NavLink to="/customers">Customers</NavLink><NavLink to="/portfolio">Portfolio</NavLink><NavLink to="/reports">Reports</NavLink></nav></header><main><Routes><Route path="/" element={<Stocks />} /><Route path="/customers" element={<Customers />} /><Route path="/portfolio" element={<Portfolio />} /><Route path="/reports" element={<Reports />} /></Routes></main></>;
}

// Fetch and filter the stock table by company name and sector.
function Stocks() {
  const [rows, setRows] = useState([]), [search, setSearch] = useState(''), [sector, setSector] = useState(''), [sectors, setSectors] = useState([]), [error, setError] = useState('');
  useEffect(() => { api.get('/stocks').then(r => { setRows(r.data); setSectors([...new Set(r.data.map(x => x.sector))]); }).catch(() => setError('Could not load stocks. Check the server connection.')); }, []);
  useEffect(() => { const timer = setTimeout(() => api.get('/stocks', { params: { search, sector } }).then(r => setRows(r.data)).catch(() => setError('Could not load stocks.')), 200); return () => clearTimeout(timer); }, [search, sector]);
  return <><PageTitle title="Stocks" subtitle="Browse listed companies and their latest prices." />{error && <p className="error">{error}</p>}<div className="filters"><input placeholder="Search company" value={search} onChange={e => setSearch(e.target.value)} /><select value={sector} onChange={e => setSector(e.target.value)}><option value="">All sectors</option>{sectors.map(s => <option key={s}>{s}</option>)}</select></div><Table columns={['Ticker', 'Company', 'Sector', 'Price', 'Exchanges']} rows={rows.map(x => [x.ticker, x.company, x.sector, money(x.price), x.exchanges || '—'])} /></>;
}

// List existing customers and submit the add-customer form.
function Customers() {
  const [rows, setRows] = useState([]), [form, setForm] = useState({ name: '', dob: '', phone: '', password: '' }), [message, setMessage] = useState('');
  // Load customer rows from the API.
  const load = () => api.get('/customers').then(r => setRows(r.data)).catch(() => setMessage('Could not load customers.'));
  useEffect(() => { load(); }, []);
  // Submit customer details and refresh the list.
  async function submit(e) { e.preventDefault(); try { await api.post('/customers', form); setForm({ name: '', dob: '', phone: '', password: '' }); setMessage('Customer added.'); load(); } catch (err) { setMessage(err.response?.data?.error || 'Could not add customer.'); } }
  return <><PageTitle title="Customers" subtitle="Add a customer and manage their portfolio." /><form className="form-row" onSubmit={submit}><input required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input required type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /><input required placeholder="Phone number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><input required type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><button>Add customer</button></form>{message && <p>{message}</p>}<Table columns={['ID', 'Name', 'Date of birth', 'Phone', 'Portfolio']} rows={rows.map(x => [x.id, x.name, date(x.dob), x.phone, x.portfolioId])} /></>;
}

// Display a selected customer's holdings and handle buys and sells.
function Portfolio() {
  const [customers, setCustomers] = useState([]), [customerId, setCustomerId] = useState(''), [rows, setRows] = useState([]), [stocks, setStocks] = useState([]), [ticker, setTicker] = useState(''), [quantity, setQuantity] = useState(1), [message, setMessage] = useState('');
  // Load customers and available stocks for the controls.
  useEffect(() => { api.get('/customers').then(r => { setCustomers(r.data); if (r.data.length) setCustomerId(String(r.data[0].id)); }); api.get('/stocks').then(r => setStocks(r.data)); }, []);
  // Refresh the selected customer's holdings.
  const load = () => customerId && api.get(`/portfolio/${customerId}`).then(r => setRows(r.data)).catch(() => setMessage('Could not load portfolio.'));
  useEffect(() => { load(); }, [customerId]);
  // Buy the requested number of shares for the selected customer.
  async function buy(e) { e.preventDefault(); try { await api.post('/portfolio', { customerId, ticker, quantity: Number(quantity) }); setMessage('Purchase recorded.'); load(); } catch (err) { setMessage(err.response?.data?.error || 'Could not buy shares.'); } }
  // Sell the requested number of shares from the selected holding.
  async function sell(stock) { const amount = Number(prompt(`Quantity to sell (held: ${stock.quantity})`, stock.quantity)); if (!amount) return; try { await api.delete(`/portfolio/${stock.ticker}`, { data: { customerId, ticker: stock.ticker, quantity: amount } }); setMessage('Sale recorded.'); load(); } catch (err) { setMessage(err.response?.data?.error || 'Could not sell shares.'); } }
  return <><PageTitle title="Portfolio" subtitle="Review holdings, then buy or sell shares." /><label className="control">Customer<select value={customerId} onChange={e => setCustomerId(e.target.value)}>{customers.map(c => <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>)}</select></label><form className="form-row" onSubmit={buy}><select required value={ticker} onChange={e => setTicker(e.target.value)}><option value="">Choose stock</option>{stocks.map(s => <option key={s.ticker} value={s.ticker}>{s.ticker} · {s.company}</option>)}</select><input required type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} /><button disabled={!customerId}>Buy shares</button></form>{message && <p>{message}</p>}<Table columns={['Ticker', 'Company', 'Quantity', 'Latest price', 'Value', '']} rows={rows.map(x => [x.ticker, x.company, x.quantity, money(x.price), money(Number(x.quantity) * Number(x.price)), <button className="secondary" onClick={() => sell(x)}>Sell</button>])} /></>;
}

// Load and display the two database reports.
function Reports() {
  const [top, setTop] = useState([]), [sectors, setSectors] = useState([]), [error, setError] = useState('');
  useEffect(() => { Promise.all([api.get('/reports/top-stocks'), api.get('/reports/sector-summary')]).then(([a, b]) => { setTop(a.data); setSectors(b.data); }).catch(() => setError('Could not load reports.')); }, []);
  return <><PageTitle title="Reports" subtitle="A quick view of popular stocks and sector coverage." />{error && <p className="error">{error}</p>}<section><h2>Top stocks by number of holders</h2><Table columns={['Ticker', 'Company', 'Holders']} rows={top.map(x => [x.ticker, x.company, x.holders])} /></section><section><h2>Sector summary</h2><Table columns={['Sector', 'Market cap', 'Companies', 'Stocks']} rows={sectors.map(x => [x.sector, money(x.marketCap), x.companies, x.stocks])} /></section></>;
}

// Render a page heading with a short description.
function PageTitle({ title, subtitle }) { return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div></div>; }

// Render plain table markup from column labels and row values.
function Table({ columns, rows }) { return <div className="table-wrap"><table><thead><tr>{columns.map(col => <th key={col}>{col}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value ?? '—'}</td>)}</tr>) : <tr><td className="empty" colSpan={columns.length}>No records found.</td></tr>}</tbody></table></div>; }

// Format a database numeric value as Indian rupees.
function money(value) { return value == null ? '—' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

// Format MySQL date values for display in the customer list.
function date(value) { return value ? new Date(value).toLocaleDateString('en-IN') : '—'; }

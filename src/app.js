const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const { errorHandler, notFound } = require('./middlewares/errorMiddleware');

const authRoutes        = require('./routes/authRoutes');
const productRoutes     = require('./routes/productRoutes');
const clientRoutes      = require('./routes/clientRoutes');
const supplierRoutes    = require('./routes/supplierRoutes');
const saleRoutes        = require('./routes/saleRoutes');
const invoiceRoutes     = require('./routes/invoiceRoutes');
const expenseRoutes     = require('./routes/expenseRoutes');
const reportRoutes      = require('./routes/reportRoutes');
const settingsRoutes    = require('./routes/settingsRoutes');
const damageRoutes      = require('./routes/damageRoutes');
const systemConfigRoutes = require('./routes/systemConfigRoutes');
const notificationRoutes = require('./routes/notificationsRoutes');
const employeeRoutes    = require('./routes/employeeRoutes');

const app = express();

// ── CORS en premier ───────────────────────────────
app.use(cors({
  origin: [
    'https://saadpoisson.com',
    'https://www.saadpoisson.com',
    'https://saad-poisson.vercel.app',
    'http://localhost:5173'
  ],
  credentials: true
}));

// ── Helmet avec cross-origin autorisé pour les images ──
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes API ────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/clients',  clientRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales',    saleRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports',  reportRoutes);
app.use('/api/damages',  damageRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/system',   systemConfigRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/employees', employeeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
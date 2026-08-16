// routes/adminOrders.js
// Admin-only: create a tracking entry per order, list/search entries, and
// update status (each update is appended to status_history).

const express = require('express');
const db = require('../db');
const { requireAdminAuth } = require('../authMiddleware');
const { isValidStatus, ORDER_STATUSES } = require('../statuses');

const router = express.Router();
router.use(requireAdminAuth);

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s-]/g, '');
}

// GET /api/admin/orders?search=xxx
router.get('/', (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  let orders = db.get('orders').value();

  if (search) {
    orders = orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(search) ||
        (o.customer_name || '').toLowerCase().includes(search) ||
        normalizePhone(o.phone).includes(search.replace(/[\s-]/g, ''))
    );
  }

  // Most recently updated first.
  orders = [...orders].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  res.json({ orders, valid_statuses: ORDER_STATUSES });
});

// POST /api/admin/orders  { order_number, phone, customer_name, status }
router.post('/', (req, res) => {
  const { order_number, phone, customer_name, status } = req.body || {};

  if (!order_number || !phone) {
    return res.status(400).json({ error: 'order_number and phone are required.' });
  }

  const initialStatus = status && isValidStatus(status) ? status : 'pending';
  const existing = db.get('orders').find({ order_number }).value();
  if (existing) {
    return res.status(409).json({ error: 'An order with this order_number already exists.' });
  }

  const now = new Date().toISOString();
  const newOrder = {
    order_number: String(order_number).trim(),
    phone: String(phone).trim(),
    customer_name: customer_name ? String(customer_name).trim() : '',
    status: initialStatus,
    status_history: [{ status: initialStatus, note: 'Order created', updated_at: now }],
    created_at: now,
    updated_at: now,
  };

  db.get('orders').push(newOrder).write();
  res.status(201).json(newOrder);
});

// PUT /api/admin/orders/:order_number  { status, note }
router.put('/:order_number', (req, res) => {
  const { order_number } = req.params;
  const { status, note } = req.body || {};

  if (!status || !isValidStatus(status)) {
    return res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }

  const orderRef = db.get('orders').find({ order_number });
  const order = orderRef.value();
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const now = new Date().toISOString();
  orderRef
    .assign({
      status,
      updated_at: now,
    })
    .write();

  db.get('orders')
    .find({ order_number })
    .get('status_history')
    .push({ status, note: note ? String(note).trim() : '', updated_at: now })
    .write();

  res.json(db.get('orders').find({ order_number }).value());
});

// DELETE /api/admin/orders/:order_number
router.delete('/:order_number', (req, res) => {
  const { order_number } = req.params;
  const order = db.get('orders').find({ order_number }).value();
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  db.get('orders').remove({ order_number }).write();
  res.status(204).end();
});

module.exports = router;

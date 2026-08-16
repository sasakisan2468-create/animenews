// routes/track.js
// Public endpoint: customers look up their order using order_number + phone.
// Requiring BOTH values (not just the order number) stops random people
// from guessing an order number and seeing someone else's status/address.

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

// Slow down lookup guessing/brute force: 20 lookups per 15 min per IP.
const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookup attempts. Please try again later.' },
});

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s-]/g, '');
}

router.get('/', trackLimiter, (req, res) => {
  const orderNumber = String(req.query.order_number || '').trim();
  const phone = normalizePhone(req.query.phone);

  if (!orderNumber || !phone) {
    return res.status(400).json({ error: 'order_number and phone are both required.' });
  }

  const order = db
    .get('orders')
    .find(
      (o) =>
        o.order_number.toLowerCase() === orderNumber.toLowerCase() &&
        normalizePhone(o.phone) === phone
    )
    .value();

  if (!order) {
    // Same generic message whether the order number or phone was wrong -
    // avoids leaking which part was incorrect.
    return res.status(404).json({ error: 'No matching order found. Please check the order number and phone.' });
  }

  return res.json({
    order_number: order.order_number,
    customer_name: order.customer_name,
    status: order.status,
    history: order.status_history,
    updated_at: order.updated_at,
  });
});

module.exports = router;

'use strict';

/**
 * EventMath Commerce Runtime v2.22
 * Stripe, Shopify, PayPal integration via raw HTTPS calls.
 */

const https = require('https');

function _httpsPost(hostname, reqPath, body, headers) {
  headers = headers || {};
  return new Promise((resolve) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const isJson = typeof body !== 'string';
    const options = {
      hostname,
      path: reqPath,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      }, headers),
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (_e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(bodyStr);
    req.end();
  });
}

function _httpsGet(hostname, reqPath, headers) {
  headers = headers || {};
  return new Promise((resolve) => {
    const options = { hostname, path: reqPath, method: 'GET', headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (_e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.end();
  });
}

async function stripeCharge(amount, currency, customerId) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: 'Set STRIPE_SECRET_KEY env var', provider: 'stripe' };
  const { URLSearchParams } = require('url');
  const body = new URLSearchParams({
    amount: String(Math.round(amount * 100)),
    currency: (currency || 'usd').toLowerCase(),
    customer: customerId || '',
    confirm: 'true',
  }).toString();
  return _httpsPost('api.stripe.com', '/v1/payment_intents', body, {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/x-www-form-urlencoded',
  });
}

async function stripeRefund(chargeId, amount) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: 'Set STRIPE_SECRET_KEY env var', provider: 'stripe' };
  const { URLSearchParams } = require('url');
  const params = { payment_intent: chargeId };
  if (amount) params.amount = String(Math.round(amount * 100));
  const body = new URLSearchParams(params).toString();
  return _httpsPost('api.stripe.com', '/v1/refunds', body, {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/x-www-form-urlencoded',
  });
}

async function shopifySync(resource) {
  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!store || !token) return { error: 'Set SHOPIFY_STORE and SHOPIFY_ACCESS_TOKEN', provider: 'shopify' };
  return _httpsGet(store + '.myshopify.com', '/admin/api/2024-01/' + resource + '.json', {
    'X-Shopify-Access-Token': token,
  });
}

async function paypalRequestPayment(amount, recipient) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) return { error: 'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET', provider: 'paypal' };
  return {
    provider: 'paypal',
    amount,
    recipient,
    paymentUrl: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=' + encodeURIComponent(recipient) + '&amount=' + amount,
    note: 'Full PayPal API requires OAuth token — see PAYPAL_CLIENT_ID env var',
  };
}

module.exports = { stripeCharge, stripeRefund, shopifySync, paypalRequestPayment };

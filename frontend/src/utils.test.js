import assert from 'node:assert/strict'
import test from 'node:test'
import { formatCurrency, money, percent } from './utils.js'

test('formatCurrency uses full rupees below one lakh', () => {
  assert.equal(formatCurrency(45230), '₹45,230.00')
  assert.equal(formatCurrency(99999.99), '₹99,999.99')
})

test('formatCurrency uses Indian lakh and crore shorthand', () => {
  assert.equal(formatCurrency(100000), '₹1.0 L')
  assert.equal(formatCurrency(3250000), '₹32.5 L')
  assert.equal(formatCurrency(10000000), '₹1.0 Cr')
  assert.equal(formatCurrency(325000000), '₹32.5 Cr')
  assert.equal(formatCurrency(-325000000), '−₹32.5 Cr')
  assert.equal(money(3250000), '₹32,50,000.00')
})

test('extreme percentage is capped for display', () => {
  assert.equal(percent('25.5'), '25.50%')
  assert.equal(percent('10000'), '10,000.00%')
  assert.equal(percent('10000.01'), '>10,000%')
})

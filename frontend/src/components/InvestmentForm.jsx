import { useEffect, useRef, useState } from 'react'
import { money, TYPE_LABELS } from '../utils'

const blank = { type: 'STOCK', name: '', purchase_date: '', purchase_price: '', quantity: '1', current_value: '', notes: '' }
const validMoney = value => /^\d+(?:\.\d{1,2})?$/.test(String(value))
const invalidDateMessage = 'This is not a valid date — please pick a valid date.'
const localToday = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export const isValidPurchaseDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

export const gainPercent = (purchasePrice, currentValue) =>
  (Number(currentValue) - Number(purchasePrice)) / Number(purchasePrice) * 100

export default function InvestmentForm({ initial, portfolios = [], defaultPortfolioId = '', onSubmit, submitting, submitLabel = 'Save investment' }) {
  const [form, setForm] = useState(initial || { ...blank, portfolio: defaultPortfolioId })
  const [errors, setErrors] = useState({})
  const [invalidDateAttempt, setInvalidDateAttempt] = useState(false)
  const [dateInputKey, setDateInputKey] = useState(0)
  const [pendingSubmit, setPendingSubmit] = useState(null)
  const dateInputRef = useRef(null)
  const cancelRef = useRef(null)
  useEffect(() => {
    setForm(initial || { ...blank, portfolio: defaultPortfolioId })
    setErrors({})
    setInvalidDateAttempt(false)
    setPendingSubmit(null)
  }, [initial])
  useEffect(() => {
    if (!pendingSubmit) return
    cancelRef.current?.focus()
    const handleEscape = event => { if (event.key === 'Escape' && !submitting) setPendingSubmit(null) }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [pendingSubmit, submitting])

  const change = event => {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
    setErrors(current => ({ ...current, [name]: undefined }))
  }
  const dateInput = event => {
    const invalid = event.target.validity.badInput || Boolean(event.target.value && !isValidPurchaseDate(event.target.value))
    setInvalidDateAttempt(current => invalid || (event.target.value === '' ? current : false))
    if (event.target.value) change(event)
    else if (!invalid) change(event)
  }
  const clearInvalidDate = () => {
    setForm(current => ({ ...current, purchase_date: '' }))
    setInvalidDateAttempt(true)
    setErrors(current => ({ ...current, purchase_date: invalidDateMessage }))
    // Some native date controls keep invalid typed text visible even when value is empty.
    setDateInputKey(current => current + 1)
  }
  const dateBlur = event => {
    if (event.target.validity.badInput || invalidDateAttempt || (event.target.value && !isValidPurchaseDate(event.target.value))) {
      clearInvalidDate()
    } else if (event.target.value && event.target.value > localToday()) {
      setErrors(current => ({ ...current, purchase_date: 'Purchase date cannot be in the future' }))
    }
  }
  const save = async values => {
    try { await onSubmit(values) } catch (error) {
      const data = error.response?.data || {}
      setErrors(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : String(value)])))
    }
  }
  const submit = async event => {
    event.preventDefault()
    const next = {}
    if (!form.portfolio) next.portfolio = 'Choose a portfolio.'
    if (!form.name.trim()) next.name = 'Enter a name.'
    if (dateInputRef.current?.validity.badInput || invalidDateAttempt || (form.purchase_date && !isValidPurchaseDate(form.purchase_date))) {
      next.purchase_date = invalidDateMessage
      clearInvalidDate()
    } else if (!form.purchase_date) next.purchase_date = 'Choose a purchase date.'
    else if (form.purchase_date > localToday()) next.purchase_date = 'Purchase date cannot be in the future'
    if (form.purchase_price === '' || !Number.isFinite(Number(form.purchase_price)) || Number(form.purchase_price) <= 0) next.purchase_price = 'Invested amount must be greater than zero.'
    else if (!validMoney(form.purchase_price)) next.purchase_price = 'Use no more than 2 decimal places.'
    if (form.quantity === '' || !Number.isFinite(Number(form.quantity)) || Number(form.quantity) <= 0) next.quantity = 'Quantity must be greater than zero.'
    if (form.current_value === '' || !Number.isFinite(Number(form.current_value)) || Number(form.current_value) < 0) next.current_value = 'Current value must be zero or greater.'
    else if (!validMoney(form.current_value)) next.current_value = 'Use no more than 2 decimal places.'
    setErrors(next)
    if (Object.keys(next).length) return

    const values = { ...form }
    const calculatedGain = gainPercent(values.purchase_price, values.current_value)
    if (calculatedGain > 5000) {
      setPendingSubmit({ values, calculatedGain })
      return
    }
    await save(values)
  }
  const continueSubmit = async () => {
    if (!pendingSubmit) return
    const values = pendingSubmit.values
    setPendingSubmit(null)
    await save(values)
  }
  const field = (name, label, type = 'text', props = {}) => <label className="field" key={name}><span>{label}</span><input name={name} type={type} value={form[name] ?? ''} onChange={change} {...props} />{errors[name] && <small className="field-error">{errors[name]}</small>}</label>

  return <>
    <form onSubmit={submit} noValidate className="investment-form"><div className="form-grid"><label className="field"><span>Portfolio</span><select name="portfolio" value={form.portfolio ?? ''} onChange={change}><option value="">Choose a portfolio</option>{portfolios.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.portfolio && <small className="field-error">{errors.portfolio}</small>}</label><label className="field"><span>Investment type</span><select name="type" value={form.type} onChange={change}>{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{errors.type && <small className="field-error">{errors.type}</small>}</label>
      {field('name', 'Investment name', 'text', { placeholder: 'e.g. S&P 500 ETF', maxLength: 200 })}
      <label className="field"><span>Purchase date</span><input key={dateInputKey} ref={dateInputRef} name="purchase_date" type="date" max={localToday()} value={form.purchase_date ?? ''} onInput={dateInput} onChange={dateInput} onBlur={dateBlur} aria-invalid={Boolean(errors.purchase_date)} />{errors.purchase_date && <small className="field-error">{errors.purchase_date}</small>}</label>
      {field('purchase_price', 'Total invested (₹)', 'number', { min: '0.01', step: '0.01', placeholder: '0.00' })}
      {field('quantity', 'Quantity', 'number', { min: '0.000001', step: '0.000001' })}
      {field('current_value', 'Current value (₹)', 'number', { min: '0', step: '0.01', placeholder: '0.00' })}
    </div><label className="field"><span>Notes <em>optional</em></span><textarea name="notes" rows="4" value={form.notes ?? ''} onChange={change} placeholder="Anything you'd like to remember about this investment" /></label>
    {errors.non_field_errors && <div className="alert error">{errors.non_field_errors}</div>}
    <button className="button primary-button" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button></form>
    {pendingSubmit && <div className="modal-backdrop"><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="gain-confirm-title" aria-describedby="gain-confirm-message">
      <div className="confirm-icon" aria-hidden="true">!</div><h2 id="gain-confirm-title">Check these amounts</h2>
      <p id="gain-confirm-message">This looks like a possible typo — invested amount is {money(pendingSubmit.values.purchase_price)} but current value is {money(pendingSubmit.values.current_value)}, a gain of {pendingSubmit.calculatedGain.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%. Continue anyway?</p>
      <div className="confirm-actions"><button ref={cancelRef} type="button" className="button secondary-button" onClick={() => setPendingSubmit(null)} disabled={submitting}>Cancel</button><button type="button" className="button primary-button" onClick={continueSubmit} disabled={submitting}>{submitting ? 'Saving…' : 'Continue'}</button></div>
    </div></div>}
  </>
}

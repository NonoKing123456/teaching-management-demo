import { nextTick, reactive } from 'vue'
import { ApiError } from './api'
import { currentYear } from './teachingCalendar'

type Rules = Record<string, () => string>
export function required(value: unknown, label: string): string {
  return String(value ?? '').trim() ? '' : `请填写${label}。`
}
export function yearError(value: unknown, optional = false): string {
  if (!String(value ?? '').trim()) return optional ? '' : '请填写年份。'
  const year = Number(value)
  return /^\d{4}$/.test(String(value).trim()) && Number.isInteger(year) && year >= 2020 && year <= currentYear ? '' : `年份须在 2020—${currentYear} 年之间。`
}
export function passwordError(value: string): string {
  return required(value, '密码') || (value.length < 8 ? '密码至少需要 8 位。' :
    value.length > 128 ? '密码不能超过 128 位。' : /^\d+$/.test(value) ? '密码不能全部使用数字，请加入字母或符号。' : '')
}
export function useFormValidation(rules: () => Rules, dependencies: Record<string, string[]> = {}) {
  const errors = reactive<Record<string, string>>({})
  const touched = new Set<string>()
  const serverFields = new Set<string>()
  let submitted = false
  function check(name: string) {
    const rule = rules()[name]
    if (!rule) return
    const message = rule()
    if (message) errors[name] = message
    else delete errors[name]
  }
  function touch(name: string) {
    touched.add(name)
    if (!serverFields.has(name)) check(name)
  }
  function change(name: string) {
    serverFields.delete(name)
    if (submitted || touched.has(name) || errors[name]) check(name)
    for (const related of dependencies[name] || []) {
      if (submitted || touched.has(related) || errors[related]) check(related)
    }
  }
  async function focusFirst(container?: HTMLElement | null) {
    await nextTick()
    const input = container?.querySelector<HTMLElement>('[aria-invalid="true"]')
    input?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    input?.focus({ preventScroll: true })
  }
  function reset() {
    for (const key of Object.keys(errors)) delete errors[key]
    touched.clear(); serverFields.clear(); submitted = false
  }
  function validate(container?: HTMLElement | null) {
    submitted = true
    for (const name of Object.keys(rules())) if (!serverFields.has(name)) check(name)
    const valid = !Object.keys(errors).length
    if (!valid) void focusFirst(container)
    return valid
  }
  function applyServerErrors(error: unknown, container?: HTMLElement | null) {
    if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') return false
    let matched = false
    for (const [name, value] of Object.entries(error.details)) {
      if (!(name in rules())) continue
      const message = Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : ''
      if (message) { errors[name] = message; serverFields.add(name); matched = true }
    }
    if (matched) void focusFirst(container)
    return matched
  }
  return { errors, reset, touch, change, validate, applyServerErrors,
    isValid: () => Object.values(rules()).every(rule => !rule()) }
}

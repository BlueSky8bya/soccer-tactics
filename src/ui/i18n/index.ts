/** Minimal i18n (A-05: i18n-ready, Korean default). Keys are stable identifiers. */
import { ko } from './ko'

export type MessageKey = keyof typeof ko
type Params = Record<string, string | number>

let current: Record<MessageKey, string> = ko

export function setLocale(messages: Record<MessageKey, string>): void {
  current = messages
}

export function t(key: MessageKey, params?: Params): string {
  let s: string = current[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

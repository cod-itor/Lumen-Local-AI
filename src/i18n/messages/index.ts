import type { Locale } from "../config";
import * as en from "./en";
import * as km from "./km";

/** All UI strings, per language. Add a namespace by adding a file to en/ and km/. */
export type Messages = typeof en;
export const MESSAGES: Record<Locale, Messages> = { en, km };

/** Dotted keys of every string, e.g. "auth.login.title". */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;

/** Look up a dotted key; unknown keys are returned as-is (handy for plain text). */
export function lookup(messages: Messages, key: string): string {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) node = (node as Record<string, unknown>)[part];
    else return key;
  }
  return typeof node === "string" ? node : key;
}

/** Fill {name}-style placeholders. */
export function format(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

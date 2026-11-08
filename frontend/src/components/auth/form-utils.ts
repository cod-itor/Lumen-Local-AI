import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { AuthResult } from "@/types/auth";

/** Push server-side field errors into react-hook-form. Returns true if any were set. */
export function applyFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, res: AuthResult<unknown>) {
  if (res.ok || !res.fieldErrors) return false;
  let first = true;
  for (const [name, message] of Object.entries(res.fieldErrors)) {
    form.setError(name as Path<T>, { type: "server", message }, { shouldFocus: first });
    first = false;
  }
  return true;
}

/** Fade-in for shadcn <FieldError> (tw-animate-css, transform/opacity only). */
export const fieldErrorClass = "animate-in fade-in slide-in-from-top-1 duration-200 text-[13px]";

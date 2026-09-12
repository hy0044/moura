export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly canonicalId?: string;
  readonly source?: string;
}

export interface ValidationResult<T = undefined> {
  readonly value?: T;
  readonly errors: readonly ValidationError[];
}

export function error(
  code: string,
  message: string,
  details: Pick<ValidationError, "canonicalId" | "source"> = {},
): ValidationError {
  return { code, message, ...details };
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  readonly [key: string]: string | number | boolean | bigint | undefined;
}

/** Structured JSON logs for mainnet indexing (GLOBAL-6). */
export function log(
  level: LogLevel,
  message: string,
  fields?: LogFields,
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    service: "layer5-settlement",
    ...fields,
  };
  const line = JSON.stringify(entry, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const CPU_NANO_FACTOR: Record<string, number> = {
  n: 1,
  u: 1_000,
  m: 1_000_000,
  "": 1_000_000_000,
  k: 1_000_000_000_000,
  M: 1_000_000_000_000_000,
  G: 1_000_000_000_000_000_000,
};

const MEMORY_BINARY_FACTOR: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  Pi: 1024 ** 5,
  Ei: 1024 ** 6,
};

const MEMORY_DECIMAL_FACTOR: Record<string, number> = {
  "": 1,
  k: 1_000,
  M: 1_000_000,
  G: 1_000_000_000,
  T: 1_000_000_000_000,
  P: 1_000_000_000_000_000,
  E: 1_000_000_000_000_000_000,
};

function parseNumberAndSuffix(input: string): { value: number; suffix: string } | null {
  const normalized = input.trim();
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)([a-zA-Z]*)$/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (Number.isNaN(value)) {
    return null;
  }

  return { value, suffix: match[2] ?? "" };
}

export function parseCpuQuantityToNanoCores(quantity: string): number | null {
  const parsed = parseNumberAndSuffix(quantity);
  if (!parsed) {
    return null;
  }

  const factor = CPU_NANO_FACTOR[parsed.suffix];
  if (!factor) {
    return null;
  }

  return Math.round(parsed.value * factor);
}

export function parseMemoryQuantityToBytes(quantity: string): number | null {
  const parsed = parseNumberAndSuffix(quantity);
  if (!parsed) {
    return null;
  }

  if (parsed.suffix in MEMORY_BINARY_FACTOR) {
    return Math.round(parsed.value * MEMORY_BINARY_FACTOR[parsed.suffix]);
  }

  if (parsed.suffix in MEMORY_DECIMAL_FACTOR) {
    return Math.round(parsed.value * MEMORY_DECIMAL_FACTOR[parsed.suffix]);
  }

  return null;
}

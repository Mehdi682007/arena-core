export type MetricLabels = Readonly<Record<string, string>>;
export interface MetricsPort {
  increment(name: string, labels?: MetricLabels, amount?: number): void;
  observe(name: string, value: number, labels?: MetricLabels): void;
  snapshot(): readonly Readonly<Record<string, unknown>>[];
}
const forbiddenLabel = /user|email|token|url|path|query|ip/i;
function safe(labels: MetricLabels): MetricLabels {
  for (const key of Object.keys(labels))
    if (forbiddenLabel.test(key)) throw new Error('High-cardinality metric label.');
  return Object.freeze({ ...labels });
}
export class InMemoryMetrics implements MetricsPort {
  readonly #events: Readonly<Record<string, unknown>>[] = [];
  public increment(name: string, labels: MetricLabels = {}, amount = 1): void {
    this.#events.push(Object.freeze({ type: 'counter', name, amount, labels: safe(labels) }));
  }
  public observe(name: string, value: number, labels: MetricLabels = {}): void {
    this.#events.push(Object.freeze({ type: 'histogram', name, value, labels: safe(labels) }));
  }
  public snapshot(): readonly Readonly<Record<string, unknown>>[] {
    return Object.freeze([...this.#events]);
  }
}
export class NoopMetrics implements MetricsPort {
  public increment(): void {}
  public observe(): void {}
  public snapshot(): readonly Readonly<Record<string, unknown>>[] {
    return Object.freeze([]);
  }
}

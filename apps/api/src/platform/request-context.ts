import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  actorUserId?: string;
  route?: string;
  method?: string;
}

const storageKey = Symbol.for('arena-core.request-context');
const globalRegistry = globalThis as unknown as Record<symbol, unknown>;
const existingStorage = globalRegistry[storageKey];
const storage =
  existingStorage instanceof AsyncLocalStorage
    ? (existingStorage as AsyncLocalStorage<RequestContext>)
    : new AsyncLocalStorage<RequestContext>();
globalRegistry[storageKey] = storage;
export const requestContext = {
  run<T>(context: RequestContext, callback: () => T): T {
    return storage.run(Object.freeze({ ...context }), callback);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
};

export const validOpaqueId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= 8 &&
  value.length <= 128 &&
  /^[A-Za-z0-9._-]+$/.test(value);

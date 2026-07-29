export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly sessionId: string;
}

export interface PrincipalRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly method: string;
  readonly ip?: string;
  principal?: AuthenticatedPrincipal;
}

export interface HttpResponse {
  status(code: number): this;
  cookie(name: string, value: string, options: Record<string, unknown>): this;
  clearCookie(name: string, options: Record<string, unknown>): this;
  setHeader(name: string, value: string | number): this;
}

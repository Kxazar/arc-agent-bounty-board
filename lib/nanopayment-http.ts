import { NextRequest, NextResponse } from "next/server";
import type { HTTPAdapter, HTTPResponseInstructions } from "@x402/core/http";

export class NextRequestAdapter implements HTTPAdapter {
  constructor(private readonly request: NextRequest) {}

  getHeader(name: string) {
    return this.request.headers.get(name) ?? undefined;
  }

  getMethod() {
    return this.request.method;
  }

  getPath() {
    return this.request.nextUrl.pathname;
  }

  getUrl() {
    return this.request.url;
  }

  getAcceptHeader() {
    return this.request.headers.get("accept") ?? "application/json";
  }

  getUserAgent() {
    return this.request.headers.get("user-agent") ?? "";
  }

  getQueryParams() {
    const params: Record<string, string | string[]> = {};

    for (const key of this.request.nextUrl.searchParams.keys()) {
      const values = this.request.nextUrl.searchParams.getAll(key);
      params[key] = values.length > 1 ? values : values[0] ?? "";
    }

    return params;
  }

  getQueryParam(name: string) {
    const values = this.request.nextUrl.searchParams.getAll(name);

    if (values.length === 0) {
      return undefined;
    }

    return values.length > 1 ? values : values[0];
  }
}

export function toNextResponse(instructions: HTTPResponseInstructions) {
  const headers = new Headers(instructions.headers);

  if (instructions.body === undefined) {
    return new NextResponse(null, {
      status: instructions.status,
      headers
    });
  }

  if (instructions.isHtml || typeof instructions.body === "string") {
    return new NextResponse(String(instructions.body), {
      status: instructions.status,
      headers
    });
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new NextResponse(JSON.stringify(instructions.body), {
    status: instructions.status,
    headers
  });
}

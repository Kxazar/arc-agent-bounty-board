import { NextRequest, NextResponse } from "next/server";
import type { HTTPAdapter, HTTPResponseInstructions } from "@x402/core/http";

import {
  createNanopaymentRequestContext,
  getMarketSignalHttpServer,
  getPremiumMarketSignalPayload
} from "@/lib/nanopayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class NextRequestAdapter implements HTTPAdapter {
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

function toNextResponse(instructions: HTTPResponseInstructions) {
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

export async function GET(request: NextRequest) {
  try {
    const httpServer = await getMarketSignalHttpServer();
    const adapter = new NextRequestAdapter(request);
    const context = createNanopaymentRequestContext(adapter, request.nextUrl.pathname, request.method);
    const processResult = await httpServer.processHTTPRequest(context, {
      appName: "Arc Agent Bounty Board",
      currentUrl: request.url,
      testnet: true
    });

    if (processResult.type === "payment-error") {
      return toNextResponse(processResult.response);
    }

    const payload = await getPremiumMarketSignalPayload();
    const payloadJson = JSON.stringify(payload);

    if (processResult.type === "no-payment-required") {
      return new NextResponse(payloadJson, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      });
    }

    const settlement = await httpServer.processSettlement(
      processResult.paymentPayload,
      processResult.paymentRequirements,
      processResult.declaredExtensions,
      {
        request: context,
        responseBody: Buffer.from(payloadJson)
      }
    );

    if (!settlement.success) {
      return toNextResponse(settlement.response);
    }

    const response = new NextResponse(payloadJson, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    });

    for (const [key, value] of Object.entries(settlement.headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to serve the Arc market signal feed.";

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}

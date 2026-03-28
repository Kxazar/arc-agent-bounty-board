import { NextRequest, NextResponse } from "next/server";

import { NextRequestAdapter, toNextResponse } from "@/lib/nanopayment-http";
import {
  createNanopaymentRequestContext,
  getIntakeBriefHttpServer,
  getPremiumIntakeBriefPayload
} from "@/lib/nanopayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const httpServer = await getIntakeBriefHttpServer();
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

    const payload = await getPremiumIntakeBriefPayload({
      bountyId: request.nextUrl.searchParams.get("bountyId"),
      agentId: request.nextUrl.searchParams.get("agentId")
    });
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
    const message = error instanceof Error ? error.message : "Unable to serve the Arc intake brief feed.";

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}

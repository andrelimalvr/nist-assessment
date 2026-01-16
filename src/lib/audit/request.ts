import { headers } from "next/headers";

export function getRequestContext() {
  const headerList = headers();
  const requestId = headerList.get("x-request-id") ?? undefined;
  const userAgent = headerList.get("user-agent") ?? undefined;
  const forwardedFor = headerList.get("x-forwarded-for");
  const realIp = headerList.get("x-real-ip");
  const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : realIp ?? undefined;

  return { requestId, userAgent, ip };
}

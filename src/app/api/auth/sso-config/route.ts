import { NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth-config";

export async function GET() {
  const config = await getAuthConfig();
  return NextResponse.json({
    ssoEnabled: config.ssoEnabled,
    allowPasswordLogin: config.allowPasswordLogin,
    enforceSso: config.enforceSso
  });
}

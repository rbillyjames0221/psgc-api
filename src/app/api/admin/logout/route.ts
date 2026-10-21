import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/release/token";
import { backTo } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  (await cookies()).delete(ADMIN_COOKIE);
  return backTo(req, {});
}

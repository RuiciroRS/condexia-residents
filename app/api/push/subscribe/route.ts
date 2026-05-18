import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PushSubscriptionBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PushSubscriptionBody;
  try {
    body = (await req.json()) as PushSubscriptionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: resident } = await supabase
    .from("residents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!resident) return NextResponse.json({ error: "Resident not found" }, { status: 404 });

  await supabase.from("push_subscriptions").upsert(
    {
      resident_id: resident.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
    { onConflict: "resident_id,endpoint" },
  );

  return NextResponse.json({ ok: true });
}

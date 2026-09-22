import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("collection_shares")
    .select("token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ token: existing.token });
  }

  const token = randomUUID().replace(/-/g, "");
  const { error } = await supabase.from("collection_shares").insert({ token, user_id: user.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token });
}

import { NextResponse } from "next/server";
import { matchShops } from "@/lib/shopMatch";
import { createClient } from "@/lib/supabase/server";

// Lojas com o que falta na coleção de quem está logado, da que tem mais para a que tem menos.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ shops: await matchShops(user.id) });
}

import { COMMUNITY_URL } from "@/lib/community";
import { communityInviteHtml } from "@/lib/email/communityInvite";

// Prévia do e-mail de convite — só em desenvolvimento (http://localhost:3000/api/comunidade/preview).
export function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  return new Response(
    communityInviteHtml({ firstName: "Fabiano", groupUrl: COMMUNITY_URL ?? "https://chat.whatsapp.com/EXEMPLO" }),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

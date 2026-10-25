import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  ATTR_COOKIE,
  ATTR_MAX_AGE,
  attributionFromUrl,
  FBC_COOKIE,
  fbcFromClick,
  fbcMatches,
} from "@/lib/attribution";

const ATTR_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: ATTR_MAX_AGE,
};

// Visita vinda de anúncio (UTM ou fbclid): grava a origem em gn_attr (last-touch, sobrescreve a anterior)
// e o _fbc da Meta. Não é httpOnly: o cadastro, no navegador, lê os dois para guardar no user_metadata.
function saveAttribution(request: NextRequest, response: NextResponse) {
  const { pathname, searchParams } = request.nextUrl;
  if (/^\/(api|_next)\//.test(pathname) || /\.[a-z0-9]+$/i.test(pathname)) return;
  const now = Date.now();
  const attr = attributionFromUrl(searchParams, pathname, now);
  if (!attr) return;
  response.cookies.set(ATTR_COOKIE, JSON.stringify(attr), ATTR_COOKIE_OPTIONS);
  if (attr.fbclid && !fbcMatches(request.cookies.get(FBC_COOKIE)?.value, attr.fbclid)) {
    // 90 dias, como o Pixel faz com o _fbc
    response.cookies.set(FBC_COOKIE, fbcFromClick(attr.fbclid, now), { ...ATTR_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 90 });
  }
}

// Next.js 16 renamed the middleware.js convention to proxy.js (same mechanics,
// runs on every request to refresh the Supabase auth cookie).
export async function proxy(request: NextRequest) {
  // Link de confirmação que caiu na página inicial com ?code= (o Supabase volta para o Site URL quando
  // o endereço pedido não está na lista de "Redirect URLs"): segue para quem troca o código pela sessão.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = `?code=${encodeURIComponent(searchParams.get("code")!)}&next=${encodeURIComponent("/login/confirmado")}`;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Optimistic cookie-based check only — refreshes the session token if needed.
  await supabase.auth.getUser();

  saveAttribution(request, response);
  return response;
}

// api/stripe fica de fora: o webhook não tem sessão de usuário e responde mais rápido sem o proxy.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|api/stripe|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

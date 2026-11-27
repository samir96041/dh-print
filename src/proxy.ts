import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie and gates private areas. Role checks (admin) happen in the pages/APIs.
export async function proxy(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.next(); // not configured yet: pages redirect themselves
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach((c) => req.cookies.set(c.name, c.value));
        res = NextResponse.next({ request: req });
        list.forEach((c) => res.cookies.set(c.name, c.value, c.options));
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*", "/checkout/:path*", "/orders/:path*"] };

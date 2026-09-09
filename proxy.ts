import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname === "/giris" ||
    pathname === "/kayit";

  if (!user) {
    if (isAuthPage) {
      return response;
    }

    return NextResponse.redirect(
      new URL("/giris", request.url)
    );
  }

  if (isAuthPage) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("PROFILE ERROR:", profileError);

    return NextResponse.redirect(
      new URL(
        "/giris?error=profil-bulunamadi",
        request.url
      )
    );
  }

  if (!profile.is_active) {
    return NextResponse.redirect(
      new URL(
        "/giris?error=hesap-pasif",
        request.url
      )
    );
  }

  if (profile.role !== "admin") {
    return NextResponse.redirect(
      new URL(
        "/giris?error=yetkisiz",
        request.url
      )
    );
  }

  response.headers.set(
    "Cache-Control",
    "private, no-store"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
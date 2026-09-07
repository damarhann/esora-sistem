import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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

  // 1. Auth kullanıcısını kontrol et
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Login ve kayıt sayfaları
  const isAuthPage =
    pathname === "/giris" ||
    pathname === "/kayit";

  // 2. Kullanıcı giriş yapmamışsa
  if (!user) {
    if (isAuthPage) {
      return response;
    }

    return NextResponse.redirect(
      new URL("/giris", request.url)
    );
  }

  // 3. Kullanıcı giriş yapmışsa ve login/kayıt sayfasına
  // gitmeye çalışıyorsa ana sayfaya gönder
  if (user && isAuthPage) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  // 4. Profiles tablosundan kullanıcı bilgilerini al
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  // 5. Profil bulunamazsa erişimi engelle
  if (profileError || !profile) {
    console.error("PROFILE ERROR:", profileError);

    return NextResponse.redirect(
      new URL("/giris?error=profil-bulunamadi", request.url)
    );
  }

  // 6. Hesap aktif değilse erişimi engelle
  if (!profile.is_active) {
    return NextResponse.redirect(
      new URL("/giris?error=hesap-pasif", request.url)
    );
  }

  // 7. Admin değilse erişimi engelle
  if (profile.role !== "admin") {
    return NextResponse.redirect(
      new URL("/giris?error=yetkisiz", request.url)
    );
  }

  // 8. Her şey uygunsa devam et
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
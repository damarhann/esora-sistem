"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function GirisPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      console.log("LOGIN 1: Giriş başlatıldı");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log("LOGIN 2: Supabase cevap verdi");
      console.log("LOGIN DATA:", data);
      console.log("LOGIN ERROR:", error);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data.session || !data.user) {
        setError("Giriş yapıldı ancak oturum oluşturulamadı.");
        setLoading(false);
        return;
      }

      console.log("LOGIN 3: Giriş başarılı");
      console.log("Kullanıcı:", data.user.email);
      console.log("Session mevcut:", !!data.session);

      // Session'ın tarayıcıda gerçekten kayıtlı olduğunu kontrol et
      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log("LOGIN 4: Mevcut session:", !!session);

      if (!session) {
        setError("Oturum oluşturulamadı. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      console.log("LOGIN 5: Dashboard'a yönlendiriliyor");

      // Tam sayfa yönlendirmesi yapıyoruz.
      // Böylece middleware session cookie'sini yeniden okuyacak.
      window.location.assign("/");
    } catch (err) {
      console.error("LOGIN CATCH ERROR:", err);

      setError("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-2">
          Giriş Yap
        </h1>

        <p className="text-gray-500 mb-6">
          Hesabınıza giriş yapın.
        </p>

        <form
          onSubmit={handleLogin}
          className="space-y-4"
        >
          <div>
            <label className="block mb-1 text-sm font-medium">
              E-posta
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              autoComplete="email"
              required
              className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium">
              Şifre
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifreniz"
              autoComplete="current-password"
              required
              className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/kayit"
            className="text-sm text-gray-600 hover:underline"
          >
            Hesabınız yok mu? Kayıt olun
          </a>
        </div>
      </div>
    </div>
  );
}
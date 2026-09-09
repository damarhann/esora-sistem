"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function SistemYonetimiPage() {
  const router = useRouter();

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleReset() {
    if (confirmation !== "SIFIRLA") {
      setError("Lütfen SIFIRLA yazın.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const { error: rpcError } = await supabase.rpc("reset_system_data", {
      p_confirmation: "SIFIRLA",
    });

    if (rpcError) {
      setError(rpcError.message || "Sistem sıfırlanırken bir hata oluştu.");
      setLoading(false);
      return;
    }

    setMessage(
      "Sistem başarıyla sıfırlandı. Tüm işletme verileri temizlendi. Yönetici hesabı korunmuştur."
    );

    setConfirmation("");
    setShowConfirm(false);
    setLoading(false);

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Sistem Yönetimi
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Yalnızca yönetici tarafından kullanılabilen sistem işlemleri.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-red-700">
              Tehlikeli İşlemler
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Bu işlem sistemdeki tüm işletme verilerini kalıcı olarak siler.
              İşlem geri alınamaz.
            </p>
          </div>

          <div className="rounded-xl bg-red-50 p-5">
            <h3 className="font-semibold text-red-800">
              Tüm sistem verilerini sıfırla
            </h3>

            <ul className="mt-3 space-y-1 text-sm text-red-700">
              <li>• Müşteriler silinir.</li>
              <li>• Ürünler silinir.</li>
              <li>• Tedarikçiler silinir.</li>
              <li>• Siparişler silinir.</li>
              <li>• Alış siparişleri silinir.</li>
              <li>• Cari hareketler silinir.</li>
              <li>• Tedarikçi hareketleri silinir.</li>
              <li>• Kasa ve banka hareketleri silinir.</li>
              <li>• Stok hareketleri silinir.</li>
              <li>• Kasa bakiyeleri 0 yapılır.</li>
              <li>• Banka bakiyeleri 0 yapılır.</li>
              <li>• Sipariş numarası yeniden 1'den başlar.</li>
              <li>• Alış sipariş numarası yeniden 1'den başlar.</li>
            </ul>

            <div className="mt-4 rounded-lg bg-white p-4 text-sm text-gray-700">
              <strong>Korunacak tek hesap:</strong>
              <br />
              Yönetici kullanıcı hesabı ve yönetici profili korunur. Böylece
              sıfırlama işleminden sonra sisteme tekrar giriş yapabilirsiniz.
            </div>

            {!showConfirm ? (
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(true);
                  setError("");
                  setMessage("");
                }}
                className="mt-6 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700"
              >
                SİSTEMİ SIFIRLA
              </button>
            ) : (
              <div className="mt-6 rounded-xl border border-red-300 bg-white p-5">
                <p className="text-sm font-semibold text-gray-800">
                  DİKKAT: Bu işlem geri alınamaz.
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  Müşteriler, ürünler, tedarikçiler ve tüm işletme kayıtları
                  kalıcı olarak silinecektir.
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  Devam etmek için aşağıdaki alana{" "}
                  <strong>SIFIRLA</strong> yazın.
                </p>

                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="SIFIRLA"
                  disabled={loading}
                  className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirm(false);
                      setConfirmation("");
                      setError("");
                    }}
                    disabled={loading}
                    className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Vazgeç
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading || confirmation !== "SIFIRLA"}
                    className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading
                      ? "SIFIRLANIYOR..."
                      : "EVET, SİSTEMİ SIFIRLA"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}


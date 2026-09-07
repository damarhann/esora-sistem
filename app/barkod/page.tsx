"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  product_name: string;
  barcode: string | null;
  category: string | null;
  purchase_price: number | null;
  retail_price: number | null;
  stock: number | null;
  unit: string | null;
};

export default function BarcodePage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [scanning, setScanning] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState(
    "Kamerayı açmak için butona bas."
  );

  async function findProduct(barcode: string) {
    setMessage(`Barkod aranıyor: ${barcode}`);

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, product_name, barcode, category, purchase_price, retail_price, stock, unit"
      )
      .eq("barcode", barcode)
      .maybeSingle();

    if (error) {
      console.error("Supabase hata:", error);
      setMessage("Ürün aranırken veritabanı hatası oluştu.");
      return;
    }

    if (!data) {
      setProduct(null);
      setMessage(
        `Bu barkoda ait ürün bulunamadı: ${barcode}`
      );
      return;
    }

    setProduct(data);
    setMessage("✅ Ürün bulundu.");
  }

  async function startScanner() {
    console.log("Kamera butonuna basıldı.");

    setMessage("Kamera başlatılıyor...");

    try {
      if (!navigator.mediaDevices) {
        setMessage(
          "Bu tarayıcı kamera erişimini desteklemiyor."
        );
        return;
      }

      const cameras = await Html5Qrcode.getCameras();

      console.log("Bulunan kameralar:", cameras);

      if (!cameras || cameras.length === 0) {
        setMessage(
          "Kamera bulunamadı. Telefonun kamera iznini kontrol et."
        );
        return;
      }

      const cameraId = cameras[0].id;

      const scanner = new Html5Qrcode("barcode-reader");

      scannerRef.current = scanner;

      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: {
            width: 280,
            height: 160,
          },
        },
        async (decodedText) => {
          console.log(
            "Barkod okundu:",
            decodedText
          );

          setMessage(
            `Barkod okundu: ${decodedText}`
          );

          await findProduct(decodedText);

          try {
            await scanner.stop();
          } catch {}

          setScanning(false);
        },
        () => {}
      );

      setScanning(true);
      setMessage(
        "📷 Kamera açık. Barkodu kameraya göster."
      );
    } catch (error) {
      console.error(
        "Kamera başlatma hatası:",
        error
      );

      setScanning(false);

      setMessage(
        "❌ Kamera açılamadı. Telefonun kamera iznini kontrol et."
      );
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
    }

    setScanning(false);
    setMessage(
      "Kamera kapatıldı."
    );
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Barkod Tara
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Ürünün barkodunu kameraya göster.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div
            id="barcode-reader"
            className="overflow-hidden rounded-xl"
          />

          {!scanning ? (
            <button
              onClick={startScanner}
              className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-4 font-semibold text-white hover:bg-slate-800"
            >
              📷 Kamerayı Aç
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="mt-5 w-full rounded-xl border border-slate-300 px-5 py-4 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kamerayı Kapat
            </button>
          )}

          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-center text-sm text-slate-700">
            {message}
          </div>

        </div>

        {product && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">
              Bulunan Ürün
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {product.product_name}
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-4">

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Barkod
                </p>

                <p className="mt-1 font-mono font-semibold">
                  {product.barcode || "-"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Kategori
                </p>

                <p className="mt-1 font-semibold">
                  {product.category || "-"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Satış Fiyatı
                </p>

                <p className="mt-1 text-lg font-bold">
                  {Number(
                    product.retail_price || 0
                  ).toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  ₺
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Stok
                </p>

                <p className="mt-1 text-lg font-bold">
                  {product.stock || 0}{" "}
                  {product.unit || "Adet"}
                </p>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
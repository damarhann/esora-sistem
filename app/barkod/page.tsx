"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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

type MessageType = "info" | "success" | "error";

function formatMoney(value: number | null) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatNumber(value: number | null) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function getStockValue(stock: number | null) {
  const value = Number(stock);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function getStockStyle(stock: number | null) {
  const value = getStockValue(stock);

  if (value <= 0) {
    return "bg-red-100 text-red-700";
  }

  if (value <= 5) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-emerald-100 text-emerald-700";
}

function getStockLabel(stock: number | null) {
  const value = getStockValue(stock);

  if (value <= 0) {
    return "Stok Yok";
  }

  if (value <= 5) {
    return "Kritik Stok";
  }

  return "Stokta";
}

export default function BarcodePage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const scanLockedRef = useRef(false);
  const mountedRef = useRef(true);

  // Kamera başlatma/durdurma yarışlarını engeller.
  const scannerSessionRef = useRef(0);

  // Eski barkod arama sonucunun yeni sonucu ezmesini engeller.
  const searchRequestRef = useRef(0);

  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [searching, setSearching] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");

  const [message, setMessage] = useState(
    "Barkodu kamerayla okutabilir veya aşağıdan manuel olarak girebilirsin."
  );

  const [messageType, setMessageType] =
    useState<MessageType>("info");

  const setFeedback = useCallback(
    (text: string, type: MessageType) => {
      if (!mountedRef.current) {
        return;
      }

      setMessage(text);
      setMessageType(type);
    },
    []
  );

  const stopScanner = useCallback(async () => {
    // Yeni bir scanner oturumunu geçersiz kıl.
    scannerSessionRef.current += 1;

    const scanner = scannerRef.current;

    if (!scanner) {
      if (mountedRef.current) {
        setScanning(false);
        setStarting(false);
      }

      return;
    }

    scannerRef.current = null;

    try {
      await scanner.stop();
    } catch (error) {
      console.warn("Kamera durdurma:", error);
    }

    try {
      scanner.clear();
    } catch (error) {
      console.warn("Tarayıcı temizleme:", error);
    }

    scanLockedRef.current = false;

    if (mountedRef.current) {
      setScanning(false);
      setStarting(false);
    }
  }, []);

  const findProduct = useCallback(
    async (barcode: string) => {
      const cleanBarcode = barcode.trim();

      if (!cleanBarcode) {
        setFeedback("Lütfen bir barkod gir.", "error");
        return;
      }

      const requestId = ++searchRequestRef.current;

      setSearching(true);
      setProduct(null);

      setFeedback(
        `Barkod aranıyor: ${cleanBarcode}`,
        "info"
      );

      try {
        const { data, error } = await supabase
          .from("products")
          .select(
            "id, product_name, barcode, category, purchase_price, retail_price, stock, unit"
          )
          .eq("barcode", cleanBarcode)
          .eq("is_active", true)
          .maybeSingle();

        if (!mountedRef.current) {
          return;
        }

        // Bu cevap artık güncel değilse hiçbir state'i değiştirme.
        if (requestId !== searchRequestRef.current) {
          return;
        }

        if (error) {
          console.error(
            "Supabase barkod arama hatası:",
            error
          );

          setProduct(null);

          setFeedback(
            "Ürün aranırken veritabanı hatası oluştu. Lütfen tekrar dene.",
            "error"
          );

          return;
        }

        if (!data) {
          setProduct(null);

          setFeedback(
            `"${cleanBarcode}" barkoduna ait aktif bir ürün bulunamadı.`,
            "error"
          );

          return;
        }

        setProduct(data as Product);
        setBarcodeInput(cleanBarcode);

        setFeedback(
          "Ürün başarıyla bulundu.",
          "success"
        );
      } catch (error) {
        console.error(
          "Barkod arama beklenmeyen hata:",
          error
        );

        if (
          mountedRef.current &&
          requestId === searchRequestRef.current
        ) {
          setProduct(null);

          setFeedback(
            "Ürün aranırken beklenmeyen bir hata oluştu. Lütfen tekrar dene.",
            "error"
          );
        }
      } finally {
        if (
          mountedRef.current &&
          requestId === searchRequestRef.current
        ) {
          setSearching(false);
        }
      }
    },
    [setFeedback]
  );

  const handleDecodedBarcode = useCallback(
    async (decodedText: string) => {
      const cleanBarcode = decodedText.trim();

      if (!cleanBarcode || scanLockedRef.current) {
        return;
      }

      scanLockedRef.current = true;

      setFeedback(
        `Barkod okundu: ${cleanBarcode}`,
        "info"
      );

      // Aynı barkodun kamera tarafından tekrar tekrar
      // okunmasını engelle.
      await stopScanner();

      try {
        await findProduct(cleanBarcode);
      } finally {
        scanLockedRef.current = false;
      }
    },
    [findProduct, setFeedback, stopScanner]
  );

  const startScanner = useCallback(async () => {
    if (starting || scanning) {
      return;
    }

    const sessionId = ++scannerSessionRef.current;

    setStarting(true);
    setProduct(null);

    setFeedback(
      "Kamera başlatılıyor...",
      "info"
    );

    try {
      if (
        typeof window === "undefined" ||
        typeof navigator === "undefined"
      ) {
        throw new Error(
          "Tarayıcı ortamı bulunamadı."
        );
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setFeedback(
          "Bu tarayıcı kamera erişimini desteklemiyor. Barkodu manuel olarak girebilirsin.",
          "error"
        );

        return;
      }

      if (scannerRef.current) {
        await stopScanner();
      }

      if (
        !mountedRef.current ||
        sessionId !== scannerSessionRef.current
      ) {
        return;
      }

      const readerElement =
        document.getElementById("barcode-reader");

      if (!readerElement) {
        throw new Error(
          "Barkod kamera alanı bulunamadı."
        );
      }

      readerElement.innerHTML = "";

      const cameras = await Html5Qrcode.getCameras();

      if (
        !mountedRef.current ||
        sessionId !== scannerSessionRef.current
      ) {
        return;
      }

      if (!cameras || cameras.length === 0) {
        setFeedback(
          "Kamera bulunamadı. Telefonunun kamera iznini ve kamera donanımını kontrol et.",
          "error"
        );

        return;
      }

      const preferredCamera =
        cameras.find((camera) =>
          camera.label
            .toLowerCase()
            .includes("back")
        ) ||
        cameras.find((camera) =>
          camera.label
            .toLowerCase()
            .includes("rear")
        ) ||
        cameras.find((camera) =>
          camera.label
            .toLowerCase()
            .includes("environment")
        ) ||
        cameras[0];

      const scanner = new Html5Qrcode(
        "barcode-reader"
      );

      scannerRef.current = scanner;
      scanLockedRef.current = false;

      await scanner.start(
        preferredCamera.id,
        {
          fps: 10,

          qrbox: (
            viewfinderWidth,
            viewfinderHeight
          ) => {
            const width = Math.min(
              300,
              Math.floor(viewfinderWidth * 0.82)
            );

            const height = Math.min(
              140,
              Math.floor(viewfinderHeight * 0.38)
            );

            return {
              width: Math.max(220, width),
              height: Math.max(100, height),
            };
          },

          aspectRatio: 1.777778,
          disableFlip: false,
        },

        async (decodedText) => {
          await handleDecodedBarcode(
            decodedText
          );
        },

        () => {
          // Her başarısız kareyi kullanıcıya göstermiyoruz.
          // Kamera sessiz şekilde taramaya devam eder.
        }
      );

      // Kamera açıldıktan sonra kullanıcı kapatmışsa
      // bu scanner artık geçersizdir.
      if (
        !mountedRef.current ||
        sessionId !== scannerSessionRef.current
      ) {
        try {
          await scanner.stop();
        } catch {}

        try {
          scanner.clear();
        } catch {}

        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }

        return;
      }

      setScanning(true);

      setFeedback(
        "📷 Kamera açık. Barkodu çerçeve içine hizala.",
        "info"
      );
    } catch (error) {
      console.error(
        "Kamera başlatma hatası:",
        error
      );

      const scanner = scannerRef.current;

      scannerRef.current = null;
      scanLockedRef.current = false;

      if (scanner) {
        try {
          await scanner.stop();
        } catch {}

        try {
          scanner.clear();
        } catch {}
      }

      if (mountedRef.current) {
        setScanning(false);

        setFeedback(
          "Kamera açılamadı. Kamera iznini kontrol et veya barkodu manuel olarak gir.",
          "error"
        );
      }
    } finally {
      if (
        mountedRef.current &&
        sessionId === scannerSessionRef.current
      ) {
        setStarting(false);
      }
    }
  }, [
    findProduct,
    handleDecodedBarcode,
    scanning,
    setFeedback,
    starting,
    stopScanner,
  ]);

  async function handleManualSearch(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (searching) {
      return;
    }

    await findProduct(barcodeInput);
  }

  function clearProduct() {
    searchRequestRef.current += 1;

    setProduct(null);
    setBarcodeInput("");
    setSearching(false);

    setFeedback(
      "Barkodu kamerayla okutabilir veya aşağıdan manuel olarak girebilirsin.",
      "info"
    );
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      scannerSessionRef.current += 1;

      const scanner = scannerRef.current;

      scannerRef.current = null;
      scanLockedRef.current = false;

      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {}
          });
      }
    };
  }, []);

  const messageClasses = {
    info: "border-slate-200 bg-slate-50 text-slate-700",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    error:
      "border-red-200 bg-red-50 text-red-700",
  };

  const stockValue = getStockValue(
    product?.stock ?? null
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link
              href="/"
              className="transition hover:text-slate-900"
            >
              Ana Sayfa
            </Link>

            <span>›</span>

            <span className="font-medium text-slate-700">
              Barkod
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Barkod Tara
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Ürünü barkoduyla hızlıca bul, stok ve
                fiyat bilgilerini görüntüle.
              </p>
            </div>

            {product ? (
              <button
                type="button"
                onClick={clearProduct}
                disabled={searching}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Temizle
              </button>
            ) : null}
          </div>
        </div>

        {/* Scanner */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-950">
              📷 Kamera ile Tara
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Telefon kamerasını kullanarak ürün barkodunu
              okut.
            </p>
          </div>

          <div
            id="barcode-reader"
            className={`min-h-[180px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 ${
              scanning
                ? ""
                : "flex items-center justify-center"
            }`}
          >
            {!scanning ? (
              <div className="px-6 py-10 text-center">
                <div className="text-4xl">
                  📦
                </div>

                <p className="mt-3 text-sm font-medium text-slate-300">
                  Kamera henüz açılmadı
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Aşağıdaki butona basarak barkod taramayı
                  başlat.
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            {!scanning ? (
              <button
                type="button"
                onClick={() =>
                  void startScanner()
                }
                disabled={starting || searching}
                className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting
                  ? "Kamera Başlatılıyor..."
                  : "📷 Kamerayı Aç"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void stopScanner()
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Kamerayı Kapat
              </button>
            )}
          </div>

          <div
            className={`mt-4 rounded-xl border p-4 text-center text-sm font-medium ${messageClasses[messageType]}`}
          >
            {message}
          </div>
        </section>

        {/* Manual Search */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">
              ⌨️ Manuel Barkod Arama
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Kamera kullanamıyorsan barkod numarasını
              buraya yazabilirsin.
            </p>
          </div>

          <form
            onSubmit={handleManualSearch}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={barcodeInput}
              onChange={(event) =>
                setBarcodeInput(
                  event.target.value
                )
              }
              placeholder="Barkod numarasını gir..."
              disabled={searching}
              aria-label="Barkod numarası"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            />

            <button
              type="submit"
              disabled={
                searching ||
                !barcodeInput.trim()
              }
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching
                ? "Aranıyor..."
                : "Ürünü Bul"}
            </button>
          </form>
        </section>

        {/* Product */}
        {product ? (
          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                    Ürün Bulundu
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">
                    {product.product_name}
                  </h2>
                </div>

                <span
                  className={`self-start rounded-full px-3 py-1.5 text-xs font-bold ${getStockStyle(
                    product.stock
                  )}`}
                >
                  {getStockLabel(
                    product.stock
                  )}
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {/* Main stats */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-400">
                    Barkod
                  </p>

                  <p className="mt-1 break-all font-mono text-sm font-bold text-slate-900">
                    {product.barcode || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-400">
                    Kategori
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {product.category ||
                      "Kategori belirtilmemiş"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-400">
                    Satış Fiyatı
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {formatMoney(
                      product.retail_price
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-400">
                    Alış Fiyatı
                  </p>

                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatMoney(
                      product.purchase_price
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs font-medium text-slate-400">
                    Mevcut Stok
                  </p>

                  <div className="mt-1 flex items-end gap-2">
                    <p
                      className={`text-2xl font-bold ${
                        stockValue <= 0
                          ? "text-red-600"
                          : stockValue <= 5
                            ? "text-amber-600"
                            : "text-slate-950"
                      }`}
                    >
                      {formatNumber(
                        product.stock
                      )}
                    </p>

                    <p className="pb-0.5 text-sm font-medium text-slate-500">
                      {product.unit ||
                        "Adet"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link
                  href={`/urunler?search=${encodeURIComponent(
                    product.barcode ||
                      product.product_name
                  )}`}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Ürünler Sayfasında Gör
                </Link>

                <Link
                  href={`/stok?product=${encodeURIComponent(
                    product.id
                  )}`}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Stok Hareketlerini Gör
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* Empty state */}
        {!product &&
        !searching &&
        messageType === "error" ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="text-3xl">
              🔎
            </div>

            <h3 className="mt-3 text-base font-bold text-slate-950">
              Ürün bulunamadı
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Barkod numarasını kontrol edip tekrar
              deneyebilir veya kamera ile yeniden
              okutabilirsin.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  image_url: string | null;
  stock: number | null;
  unit: string | null;
};

type OrderItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
};

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  customer_type: string | null;
};

export default function SiparisToplaPage() {
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scannerReady, setScannerReady] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);

  const [search, setSearch] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);

  // Müşteri
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Sipariş kaydı
  const [savingOrder, setSavingOrder] = useState(false);
  const [savedOrderNumber, setSavedOrderNumber] =
    useState<number | null>(null);
  const [savedOrderTotal, setSavedOrderTotal] =
    useState<number | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingScanRef = useRef(false);

  function formatPrice(value: number | null) {
    return Number(value || 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // --------------------------------------------------
  // ÜRÜN - BARKOD
  // --------------------------------------------------

  async function findProductByBarcode(value: string) {
    const cleanBarcode = value.trim();

    if (!cleanBarcode) return;

    setLoadingProduct(true);

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, product_name, sku, barcode, category, wholesale_price, retail_price, image_url, stock, unit"
      )
      .eq("barcode", cleanBarcode)
      .eq("is_active", true)
      .maybeSingle();

    setLoadingProduct(false);

    if (error) {
      console.error(error);
      alert("Ürün aranırken hata oluştu.");
      return;
    }

    if (!data) {
      alert(
        `Bu barkoda ait aktif ürün bulunamadı.\n\nBarkod: ${cleanBarcode}`
      );
      return;
    }

    addToCart(data);
    setBarcode("");
  }

  function addToCart(product: Product) {
    const wholesalePrice = Number(product.wholesale_price || 0);

    if (wholesalePrice <= 0) {
      alert(
        `Bu ürünün toptan satış fiyatı girilmemiş.\n\nÜrün: ${product.product_name}\n\nÖnce Ürünler bölümünden toptan fiyatı gir.`
      );
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.product.id === product.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          product,
          quantity: 1,
          unitPrice: wholesalePrice,
        },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity,
            }
          : item
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) => item.product.id !== productId
      )
    );
  }

  function clearCart() {
    if (cart.length === 0) return;

    const confirmed = window.confirm(
      "Siparişteki tüm ürünler kaldırılacak. Emin misin?"
    );

    if (confirmed) {
      setCart([]);
    }
  }

  // --------------------------------------------------
  // KAMERA / BARKOD TARAMA
  // --------------------------------------------------

  async function stopScanner() {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();

        if (state === 2) {
          await scannerRef.current.stop();
        }

        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (error) {
      console.error("Scanner kapatma hatası:", error);

      try {
        scannerRef.current?.clear();
      } catch {
        // Temizleme hatası göz ardı edilir.
      }

      scannerRef.current = null;
    }

    processingScanRef.current = false;
    setScanning(false);
    setScannerReady(false);
  }

  async function handleScanSuccess(decodedText: string) {
    if (processingScanRef.current) {
      return;
    }

    const cleanBarcode = decodedText.trim();

    if (!cleanBarcode) {
      return;
    }

    processingScanRef.current = true;

    try {
      setBarcode(cleanBarcode);

      await stopScanner();

      await findProductByBarcode(cleanBarcode);
    } finally {
      processingScanRef.current = false;
    }
  }

  async function startScanner() {
    if (scanning) {
      return;
    }

    setCameraError("");
    setScannerReady(false);

    try {
      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          "Bu cihazda kamera kullanılamıyor. Lütfen barkodu elle girmeyi deneyin."
        );
        return;
      }

      const scannerElement = document.getElementById(
        "esora-barcode-reader"
      );

      if (!scannerElement) {
        setCameraError(
          "Kamera alanı hazırlanamadı. Sayfayı yenileyip tekrar deneyin."
        );
        return;
      }

      if (scannerRef.current) {
        try {
          await stopScanner();
        } catch {
          // Önceki scanner temizlenemezse yeni scanner yine denenir.
        }
      }

      const scanner = new Html5Qrcode(
        "esora-barcode-reader"
      );

      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,
          qrbox: {
            width: 280,
            height: 140,
          },
          aspectRatio: 1.777778,
          disableFlip: false,
        },
        async (decodedText) => {
          await handleScanSuccess(decodedText);
        },
        () => {
          // Barkod bulunamadığında burada işlem yapmıyoruz.
        }
      );

      setScanning(true);
      setScannerReady(true);
    } catch (error) {
      console.error("Kamera başlatma hatası:", error);

      scannerRef.current = null;
      setScanning(false);
      setScannerReady(false);

      let message =
        "Kamera açılamadı. Tarayıcıdan kamera izni vermen gerekiyor.";

      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (
          errorMessage.includes("permission") ||
          errorMessage.includes("notallowed")
        ) {
          message =
            "Kamera izni verilmedi. Tarayıcının adres çubuğundaki kamera izinlerinden bu siteye kamera erişimi ver.";
        } else if (
          errorMessage.includes("notfound") ||
          errorMessage.includes("camera")
        ) {
          message =
            "Kamera bulunamadı. Telefonunun kamerasının kullanılabilir olduğundan emin ol.";
        } else if (
          errorMessage.includes("secure") ||
          errorMessage.includes("https")
        ) {
          message =
            "Kamera için güvenli bağlantı gerekiyor. Siteyi HTTPS üzerinden aç.";
        }
      }

      setCameraError(message);
    }
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {
              // Temizleme hatası göz ardı edilir.
            }

            scannerRef.current = null;
          });
      }
    };
  }, []);

  // --------------------------------------------------
  // MÜŞTERİ ARAMA
  // --------------------------------------------------

  async function searchCustomers(value: string) {
    setCustomerSearch(value);

    if (!value.trim()) {
      setCustomers([]);
      return;
    }

    setLoadingCustomers(true);

    const cleanValue = value.trim();

    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, company_name, contact_name, phone, city, district, customer_type"
      )
      .or(
        `company_name.ilike.%${cleanValue}%,contact_name.ilike.%${cleanValue}%,phone.ilike.%${cleanValue}%`
      )
      .order("company_name", {
        ascending: true,
      })
      .limit(10);

    setLoadingCustomers(false);

    if (error) {
      console.error(error);
      alert("Müşteriler aranırken hata oluştu.");
      return;
    }

    setCustomers(data || []);
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setCustomers([]);
  }

  function removeSelectedCustomer() {
    setSelectedCustomer(null);
  }

  // --------------------------------------------------
  // MANUEL ÜRÜN ARAMA
  // --------------------------------------------------

  async function searchProducts(value: string) {
    setSearch(value);

    if (!value.trim()) {
      setProducts([]);
      return;
    }

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, product_name, sku, barcode, category, wholesale_price, retail_price, image_url, stock, unit"
      )
      .eq("is_active", true)
      .or(
        `product_name.ilike.%${value}%,sku.ilike.%${value}%,barcode.ilike.%${value}%`
      )
      .limit(10);

    if (error) {
      console.error(error);
      return;
    }

    setProducts(data || []);
  }

  // --------------------------------------------------
  // TOPLAM
  // --------------------------------------------------

  function totalAmount() {
    return cart.reduce(
      (total, item) =>
        total + item.quantity * item.unitPrice,
      0
    );
  }

  // --------------------------------------------------
  // SİPARİŞ KAYDET
  // --------------------------------------------------

  async function saveOrder() {
    if (!selectedCustomer) {
      alert("Lütfen önce müşteri seç.");
      return;
    }

    if (cart.length === 0) {
      alert("Sipariş için en az bir ürün eklemelisin.");
      return;
    }

    // Fiyat kontrolü
    const invalidPrice = cart.find(
      (item) => item.unitPrice <= 0
    );

    if (invalidPrice) {
      alert(
        `Toptan fiyatı olmayan ürün var:\n\n${invalidPrice.product.product_name}`
      );
      return;
    }

    // Miktar kontrolü
    const invalidQuantity = cart.find(
      (item) => item.quantity <= 0
    );

    if (invalidQuantity) {
      alert(
        `Geçersiz ürün miktarı:\n\n${invalidQuantity.product.product_name}`
      );
      return;
    }

    setSavingOrder(true);

    try {
      const items = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { data, error } = await supabase.rpc(
        "create_order",
        {
          p_customer_id: selectedCustomer.id,
          p_items: items,
        }
      );

      if (error) {
        console.error(error);

        alert(
          `Sipariş kaydedilemedi.\n\n${error.message}`
        );

        return;
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      if (!result) {
        alert(
          "Sipariş oluşturuldu ancak sonuç alınamadı."
        );
        return;
      }

      setSavedOrderNumber(
        Number(result.result_order_number)
      );

      setSavedOrderTotal(
        Number(result.result_total)
      );

      setCart([]);
    } catch (error) {
      console.error(error);

      alert(
        "Sipariş kaydedilirken beklenmeyen bir hata oluştu."
      );
    } finally {
      setSavingOrder(false);
    }
  }

  // --------------------------------------------------
  // YENİ SİPARİŞ
  // --------------------------------------------------

  async function startNewOrder() {
    await stopScanner();

    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomers([]);
    setCart([]);
    setBarcode("");
    setSearch("");
    setProducts([]);
    setSavedOrderNumber(null);
    setSavedOrderTotal(null);
    setCameraError("");
  }

  // --------------------------------------------------
  // BAŞARILI SİPARİŞ EKRANI
  // --------------------------------------------------

  if (savedOrderNumber !== null) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-bold text-slate-900">
              Sipariş Kaydedildi
            </h1>

            <p className="mt-3 text-slate-500">
              Sipariş başarıyla sisteme kaydedildi.
            </p>

            <div className="mt-8 rounded-2xl bg-slate-50 p-6">
              <p className="text-sm text-slate-500">
                Sipariş No
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-900">
                #{savedOrderNumber}
              </p>

              {savedOrderTotal !== null && (
                <>
                  <p className="mt-5 text-sm text-slate-500">
                    Sipariş Toplamı
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {formatPrice(savedOrderTotal)} ₺
                  </p>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={startNewOrder}
                className="flex-1 rounded-xl bg-slate-900 px-5 py-4 font-bold text-white hover:bg-slate-800"
              >
                + Yeni Sipariş
              </button>

              <Link
                href="/"
                className="flex-1 rounded-xl border border-slate-200 px-5 py-4 font-bold text-slate-700 hover:bg-slate-50"
              >
                Ana Sayfa
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // ANA EKRAN
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2">
              <Link
                href="/urunler"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                ← Ürünlere Dön
              </Link>
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              Sipariş Topla
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Müşterinin siparişini barkod okutarak hızlıca oluştur.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            {cart.length} ürün
          </div>
        </div>

        {/* MÜŞTERİ */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              👤 Müşteri
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Siparişin hangi müşteriye ait olduğunu seç.
            </p>
          </div>

          {selectedCustomer ? (
            <div className="flex flex-col gap-4 rounded-xl border border-green-200 bg-green-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold text-slate-900">
                  {selectedCustomer.company_name}
                </p>

                {selectedCustomer.contact_name && (
                  <p className="mt-1 text-sm text-slate-600">
                    Yetkili: {selectedCustomer.contact_name}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  {selectedCustomer.phone && (
                    <span>
                      📞 {selectedCustomer.phone}
                    </span>
                  )}

                  {selectedCustomer.city && (
                    <span>
                      📍 {selectedCustomer.city}
                      {selectedCustomer.district
                        ? ` / ${selectedCustomer.district}`
                        : ""}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={removeSelectedCustomer}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Müşteriyi Değiştir
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerSearch}
                onChange={(e) =>
                  searchCustomers(e.target.value)
                }
                placeholder="Müşteri / nalbur adı, yetkili veya telefon..."
                className="w-full rounded-xl border border-slate-200 px-4 py-4 outline-none focus:border-slate-400"
              />

              {loadingCustomers && (
                <p className="mt-2 text-xs text-slate-400">
                  Müşteriler aranıyor...
                </p>
              )}

              {customers.length > 0 && (
                <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() =>
                        selectCustomer(customer)
                      }
                      className="w-full p-4 text-left hover:bg-slate-50"
                    >
                      <p className="font-bold text-slate-900">
                        {customer.company_name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {customer.contact_name
                          ? `${customer.contact_name} • `
                          : ""}
                        {customer.phone || "Telefon yok"}
                      </p>

                      {(customer.city ||
                        customer.district) && (
                        <p className="mt-1 text-xs text-slate-400">
                          📍 {customer.city || ""}
                          {customer.district
                            ? ` / ${customer.district}`
                            : ""}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BARKOD */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              📷 Ürün Ekle
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Numunenin barkodunu okut veya barkodu elle gir.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={barcode}
              onChange={(e) =>
                setBarcode(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  findProductByBarcode(barcode);
                }
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Barkodu okut veya yaz..."
              className="flex-1 rounded-xl border border-slate-200 px-4 py-4 font-mono text-lg outline-none focus:border-slate-400"
            />

            <button
              onClick={() =>
                findProductByBarcode(barcode)
              }
              disabled={
                loadingProduct || !barcode.trim()
              }
              className="rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingProduct
                ? "Aranıyor..."
                : "Ürünü Bul"}
            </button>

            {!scanning ? (
              <button
                onClick={startScanner}
                className="rounded-xl border border-slate-200 bg-white px-6 py-4 font-semibold text-slate-700 hover:bg-slate-50"
              >
                📷 Barkod Tara
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 font-semibold text-red-600 hover:bg-red-100"
              >
                Kamerayı Kapat
              </button>
            )}
          </div>

          {cameraError && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              {cameraError}
            </div>
          )}

          {/* KAMERA */}
          <div
            className={`mt-5 overflow-hidden rounded-2xl bg-black ${
              scanning ? "block" : "hidden"
            }`}
          >
            <div className="relative">
              <div
                id="esora-barcode-reader"
                className="w-full"
              />

              {scanning && (
                <>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-32 w-72 rounded-xl border-2 border-white shadow-lg" />
                  </div>

                  <div className="absolute bottom-4 left-0 right-0 text-center text-sm font-semibold text-white">
                    Barkodu çerçevenin içine getir
                  </div>
                </>
              )}
            </div>
          </div>

          {scanning && scannerReady && (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-center text-sm font-semibold text-green-700">
              ✓ Kamera aktif — barkodu okut
            </div>
          )}
        </div>

        {/* MANUEL ÜRÜN ARAMA */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-slate-900">
            🔎 Ürün Ara
          </h2>

          <input
            value={search}
            onChange={(e) =>
              searchProducts(e.target.value)
            }
            placeholder="Ürün adı, SKU veya barkod..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
          />

          {products.length > 0 && (
            <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    addToCart(product);
                    setSearch("");
                    setProducts([]);
                  }}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-slate-300">
                        📷
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {product.product_name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      SKU: {product.sku || "-"}{" "}
                      • Barkod: {product.barcode || "-"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {formatPrice(
                        product.wholesale_price
                      )}{" "}
                      ₺
                    </p>

                    <p className="text-xs text-slate-400">
                      Toptan
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SEPET */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">
                Sipariş Ürünleri
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Okutulan ürünler burada toplanır.
              </p>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-sm font-semibold text-red-500 hover:underline"
              >
                Siparişi Temizle
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl">
                🛒
              </div>

              <p className="mt-4 font-semibold text-slate-700">
                Henüz ürün eklenmedi
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Barkod okut veya ürün arayarak siparişe ekle.
              </p>
            </div>
          ) : (
            <div>
              <div className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const lineTotal =
                    item.quantity * item.unitPrice;

                  const stock =
                    Number(item.product.stock || 0);

                  const stockWarning =
                    item.quantity > stock;

                  return (
                    <div
                      key={item.product.id}
                      className="flex flex-col gap-4 p-5 md:flex-row md:items-center"
                    >
                      {/* GÖRSEL */}
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        {item.product.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.product_name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-xl text-slate-300">
                            📷
                          </span>
                        )}
                      </div>

                      {/* ÜRÜN */}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900">
                          {item.product.product_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          SKU: {item.product.sku || "-"}{" "}
                          • Barkod: {item.product.barcode || "-"}
                        </p>

                        <p className="mt-1 text-sm font-semibold text-blue-700">
                          {formatPrice(item.unitPrice)} ₺ /{" "}
                          {item.product.unit || "Adet"}
                        </p>

                        <p
                          className={`mt-1 text-xs font-medium ${
                            stockWarning
                              ? "text-red-600"
                              : "text-slate-400"
                          }`}
                        >
                          Stok: {formatPrice(stock)}{" "}
                          {item.product.unit || "Adet"}
                        </p>

                        {stockWarning && (
                          <p className="mt-1 text-xs font-bold text-red-600">
                            ⚠️ Sipariş miktarı mevcut stoğu aşıyor.
                          </p>
                        )}
                      </div>

                      {/* MİKTAR */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.quantity - 1
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-700 hover:bg-slate-50"
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(
                              item.product.id,
                              Number(e.target.value)
                            )
                          }
                          className="h-10 w-20 rounded-lg border border-slate-200 text-center font-semibold outline-none focus:border-slate-400"
                        />

                        <button
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.quantity + 1
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-700 hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>

                      {/* TOPLAM */}
                      <div className="min-w-28 text-right">
                        <p className="text-xs text-slate-400">
                          Toplam
                        </p>

                        <p className="text-lg font-bold text-slate-900">
                          {formatPrice(lineTotal)} ₺
                        </p>
                      </div>

                      {/* SİL */}
                      <button
                        onClick={() =>
                          removeFromCart(item.product.id)
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Ürünü kaldır"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* TOPLAM */}
              <div className="border-t border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-slate-700">
                    Sipariş Toplamı
                  </span>

                  <span className="text-2xl font-bold text-slate-900">
                    {formatPrice(totalAmount())} ₺
                  </span>
                </div>

                {!selectedCustomer && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
                    Siparişi kaydetmek için önce müşteri seçmelisin.
                  </div>
                )}

                <button
                  onClick={saveOrder}
                  disabled={
                    savingOrder ||
                    cart.length === 0 ||
                    !selectedCustomer
                  }
                  className="mt-4 w-full rounded-xl bg-slate-900 px-5 py-4 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingOrder
                    ? "Sipariş Kaydediliyor..."
                    : "💾 Siparişi Kaydet"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
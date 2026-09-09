"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
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

type MessageType = "info" | "success" | "error" | "warning";

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

function normalizeCustomer(value: unknown): Customer | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  return {
    id: String(raw.id ?? ""),
    company_name: String(raw.company_name ?? ""),
    contact_name:
      raw.contact_name === null || raw.contact_name === undefined
        ? null
        : String(raw.contact_name),
    phone:
      raw.phone === null || raw.phone === undefined
        ? null
        : String(raw.phone),
    city:
      raw.city === null || raw.city === undefined
        ? null
        : String(raw.city),
    district:
      raw.district === null || raw.district === undefined
        ? null
        : String(raw.district),
    customer_type:
      raw.customer_type === null ||
      raw.customer_type === undefined
        ? null
        : String(raw.customer_type),
  };
}

function normalizeProduct(value: unknown): Product | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  const product: Product = {
    id: String(raw.id ?? ""),
    product_name: String(raw.product_name ?? ""),
    sku:
      raw.sku === null || raw.sku === undefined
        ? null
        : String(raw.sku),
    barcode:
      raw.barcode === null || raw.barcode === undefined
        ? null
        : String(raw.barcode),
    category:
      raw.category === null || raw.category === undefined
        ? null
        : String(raw.category),
    wholesale_price:
      raw.wholesale_price === null ||
      raw.wholesale_price === undefined
        ? null
        : Number(raw.wholesale_price),
    retail_price:
      raw.retail_price === null ||
      raw.retail_price === undefined
        ? null
        : Number(raw.retail_price),
    image_url:
      raw.image_url === null || raw.image_url === undefined
        ? null
        : String(raw.image_url),
    stock:
      raw.stock === null || raw.stock === undefined
        ? null
        : Number(raw.stock),
    unit:
      raw.unit === null || raw.unit === undefined
        ? null
        : String(raw.unit),
  };

  return product.id ? product : null;
}

export default function SiparisToplaPage() {
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [startingScanner, setStartingScanner] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);

  const [search, setSearch] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [loadingCustomers, setLoadingCustomers] =
    useState(false);

  const [savingOrder, setSavingOrder] = useState(false);
  const [savedOrderNumber, setSavedOrderNumber] =
    useState<number | null>(null);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(
    null
  );
  const [savedOrderTotal, setSavedOrderTotal] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<MessageType>("info");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingScanRef = useRef(false);
  const mountedRef = useRef(true);

  const customerSearchRequestRef = useRef(0);
  const productSearchRequestRef = useRef(0);

  const setStatusMessage = useCallback(
    (text: string, type: MessageType = "info") => {
      setMessage(text);
      setMessageType(type);
    },
    []
  );

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    scannerRef.current = null;
    processingScanRef.current = false;

    if (mountedRef.current) {
      setScanning(false);
      setScannerReady(false);
    }

    if (!scanner) {
      return;
    }

    try {
      await scanner.stop();
    } catch (error) {
      console.warn("Scanner durdurma uyarısı:", error);
    }

    try {
      scanner.clear();
    } catch (error) {
      console.warn("Scanner temizleme uyarısı:", error);
    }
  }, []);

  const findProductByBarcode = useCallback(
    async (value: string) => {
      const cleanBarcode = value.trim();

      if (!cleanBarcode) {
        setStatusMessage(
          "Lütfen bir barkod gir.",
          "warning"
        );
        return;
      }

      setLoadingProduct(true);
      setStatusMessage(
        `Barkod aranıyor: ${cleanBarcode}`,
        "info"
      );

      const { data, error } = await supabase
        .from("products")
        .select(
          "id, product_name, sku, barcode, category, wholesale_price, retail_price, image_url, stock, unit"
        )
        .eq("barcode", cleanBarcode)
        .eq("is_active", true)
        .maybeSingle();

      if (!mountedRef.current) {
        return;
      }

      setLoadingProduct(false);

      if (error) {
        console.error(
          "Barkod ürün arama hatası:",
          error
        );

        setStatusMessage(
          "Ürün aranırken veritabanı hatası oluştu.",
          "error"
        );
        return;
      }

      const normalizedProduct = normalizeProduct(data);

      if (!normalizedProduct) {
        setStatusMessage(
          `"${cleanBarcode}" barkoduna ait aktif ürün bulunamadı.`,
          "error"
        );
        return;
      }

      addToCart(normalizedProduct);
      setBarcode("");

      setStatusMessage(
        `${normalizedProduct.product_name} siparişe eklendi.`,
        "success"
      );
    },
    []
  );

  function addToCart(product: Product) {
    const wholesalePrice = Number(
      product.wholesale_price || 0
    );

    if (wholesalePrice <= 0) {
      setStatusMessage(
        `"${product.product_name}" ürününün toptan satış fiyatı girilmemiş. Önce Ürünler bölümünden fiyatı tanımla.`,
        "warning"
      );
      return;
    }

    const stock = Number(product.stock || 0);

    if (stock <= 0) {
      setStatusMessage(
        `"${product.product_name}" ürününün mevcut stoğu 0.`,
        "warning"
      );
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

  function updateQuantity(
    productId: string,
    rawQuantity: number
  ) {
    if (!Number.isFinite(rawQuantity)) {
      return;
    }

    if (rawQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const quantity = Math.min(
      Math.floor(rawQuantity),
      999999
    );

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
    if (cart.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Siparişteki tüm ürünler kaldırılacak. Emin misin?"
    );

    if (!confirmed) {
      return;
    }

    setCart([]);
    setStatusMessage(
      "Sepet temizlendi.",
      "info"
    );
  }

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
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
      } catch (error) {
        console.error(
          "Barkod işleme hatası:",
          error
        );

        if (mountedRef.current) {
          setStatusMessage(
            "Barkod işlenirken bir hata oluştu.",
            "error"
          );
        }
      } finally {
        processingScanRef.current = false;
      }
    },
    [findProductByBarcode, stopScanner]
  );

  const startScanner = useCallback(async () => {
    if (scanning || startingScanner || scannerRef.current) {
      return;
    }

    setCameraError("");
    setScannerReady(false);
    setStartingScanner(true);
    setScanning(true);

    try {
      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          "Bu tarayıcı kamera erişimini desteklemiyor."
        );
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      const scannerElement =
        document.getElementById(
          "esora-barcode-reader"
        );

      if (!scannerElement) {
        throw new Error(
          "Kamera alanı hazırlanamadı."
        );
      }

      scannerElement.innerHTML = "";

      const scanner = new Html5Qrcode(
        "esora-barcode-reader"
      );

      scannerRef.current = scanner;
      processingScanRef.current = false;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
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
          await handleScanSuccess(decodedText);
        },
        () => {
          // Her başarısız kareyi kullanıcıya göstermiyoruz.
        }
      );

      if (!mountedRef.current) {
        try {
          await scanner.stop();
        } catch {}

        return;
      }

      setScannerReady(true);
      setCameraError("");
      setStartingScanner(false);
      setStatusMessage(
        "Kamera açık. Barkodu çerçeve içine hizala.",
        "info"
      );
    } catch (error) {
      console.error(
        "Kamera başlatma hatası:",
        error
      );

      const scanner = scannerRef.current;

      scannerRef.current = null;
      processingScanRef.current = false;

      if (scanner) {
        try {
          await scanner.stop();
        } catch {}

        try {
          scanner.clear();
        } catch {}
      }

      let errorMessage =
        "Kamera açılamadı. Kamera iznini kontrol et.";

      if (error instanceof Error) {
        const text = error.message.toLowerCase();

        if (
          text.includes("permission") ||
          text.includes("notallowed") ||
          text.includes("denied")
        ) {
          errorMessage =
            "Kamera izni verilmedi. Tarayıcı ayarlarından bu site için kamera erişimine izin ver.";
        } else if (
          text.includes("notfound") ||
          text.includes("no camera")
        ) {
          errorMessage =
            "Kamera bulunamadı veya başka bir uygulama tarafından kullanılıyor.";
        } else if (
          text.includes("secure") ||
          text.includes("https")
        ) {
          errorMessage =
            "Kamera kullanımı için HTTPS bağlantısı gerekiyor.";
        } else {
          errorMessage =
            `Kamera başlatılamadı: ${error.message}`;
        }
      }

      if (mountedRef.current) {
        setScanning(false);
        setScannerReady(false);
        setCameraError(errorMessage);
        setStartingScanner(false);
        setStatusMessage(
          "Kamera kullanılamıyor. Barkodu manuel olarak girebilirsin.",
          "warning"
        );
      }
    }
  }, [
    handleScanSuccess,
    scanning,
    startingScanner,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const scanner = scannerRef.current;

      scannerRef.current = null;

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

  async function searchCustomers(value: string) {
    setCustomerSearch(value);

    const cleanValue = value.trim();
    const requestId =
      ++customerSearchRequestRef.current;

    if (!cleanValue) {
      setCustomers([]);
      setLoadingCustomers(false);
      return;
    }

    setLoadingCustomers(true);

    const escapedValue = cleanValue
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, company_name, contact_name, phone, city, district, customer_type"
      )
      .or(
        `company_name.ilike.%${escapedValue}%,contact_name.ilike.%${escapedValue}%,phone.ilike.%${escapedValue}%`
      )
      .order("company_name", {
        ascending: true,
      })
      .limit(10);

    if (
      requestId !== customerSearchRequestRef.current ||
      !mountedRef.current
    ) {
      return;
    }

    setLoadingCustomers(false);

    if (error) {
      console.error(
        "Müşteri arama hatası:",
        error
      );

      setCustomers([]);
      setStatusMessage(
        "Müşteriler aranırken hata oluştu.",
        "error"
      );
      return;
    }

    const normalizedCustomers = (data || [])
      .map(normalizeCustomer)
      .filter(
        (customer): customer is Customer =>
          customer !== null
      );

    setCustomers(normalizedCustomers);
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setCustomers([]);

    setStatusMessage(
      `${customer.company_name} müşterisi seçildi.`,
      "success"
    );
  }

  function removeSelectedCustomer() {
    setSelectedCustomer(null);
    setStatusMessage(
      "Müşteri seçimi kaldırıldı.",
      "info"
    );
  }

  async function searchProducts(value: string) {
    setSearch(value);

    const cleanValue = value.trim();
    const requestId =
      ++productSearchRequestRef.current;

    if (!cleanValue) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }

    setLoadingProducts(true);

    const escapedValue = cleanValue
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, product_name, sku, barcode, category, wholesale_price, retail_price, image_url, stock, unit"
      )
      .eq("is_active", true)
      .or(
        `product_name.ilike.%${escapedValue}%,sku.ilike.%${escapedValue}%,barcode.ilike.%${escapedValue}%`
      )
      .order("product_name", {
        ascending: true,
      })
      .limit(10);

    if (
      requestId !== productSearchRequestRef.current ||
      !mountedRef.current
    ) {
      return;
    }

    setLoadingProducts(false);

    if (error) {
      console.error(
        "Ürün arama hatası:",
        error
      );

      setProducts([]);
      setStatusMessage(
        "Ürünler aranırken hata oluştu.",
        "error"
      );
      return;
    }

    const normalizedProducts = (data || [])
      .map(normalizeProduct)
      .filter(
        (product): product is Product =>
          product !== null
      );

    setProducts(normalizedProducts);
  }

  const totalAmount = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total + item.quantity * item.unitPrice,
        0
      ),
    [cart]
  );

  const totalQuantity = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + item.quantity,
        0
      ),
    [cart]
  );

  const stockWarningCount = useMemo(
    () =>
      cart.filter(
        (item) =>
          item.quantity >
          Number(item.product.stock || 0)
      ).length,
    [cart]
  );

  async function saveOrder() {
    if (savingOrder) {
      return;
    }

    if (!selectedCustomer) {
      setStatusMessage(
        "Siparişi kaydetmek için önce müşteri seç.",
        "warning"
      );
      return;
    }

    if (cart.length === 0) {
      setStatusMessage(
        "Sipariş için en az bir ürün eklemelisin.",
        "warning"
      );
      return;
    }

    const invalidPrice = cart.find(
      (item) => item.unitPrice <= 0
    );

    if (invalidPrice) {
      setStatusMessage(
        `"${invalidPrice.product.product_name}" ürününün satış fiyatı geçersiz.`,
        "error"
      );
      return;
    }

    const invalidQuantity = cart.find(
      (item) =>
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0
    );

    if (invalidQuantity) {
      setStatusMessage(
        `"${invalidQuantity.product.product_name}" ürününün miktarı geçersiz.`,
        "error"
      );
      return;
    }

    if (stockWarningCount > 0) {
      const confirmed = window.confirm(
        "Sepette mevcut stoktan fazla miktar bulunan ürün var.\n\nSistem siparişi kaydederken stok kontrolü yapacaktır. Devam etmek istiyor musun?"
      );

      if (!confirmed) {
        return;
      }
    }

    const confirmed = window.confirm(
      `Sipariş kaydedilecek.\n\nMüşteri: ${selectedCustomer.company_name}\nÜrün: ${cart.length} kalem\nMiktar: ${formatNumber(totalQuantity)}\nToplam: ${formatMoney(totalAmount)}\n\nDevam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    setSavingOrder(true);
    setStatusMessage(
      "Sipariş kaydediliyor...",
      "info"
    );

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
        console.error(
          "Sipariş oluşturma hatası:",
          error
        );

        setStatusMessage(
          `Sipariş kaydedilemedi: ${error.message}`,
          "error"
        );
        return;
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      if (!result) {
        setStatusMessage(
          "Sipariş işlemi tamamlandı ancak sipariş bilgisi alınamadı.",
          "error"
        );
        return;
      }

      const orderNumber = Number(
        result.result_order_number
      );

      const orderTotal = Number(
        result.result_total
      );

      const orderId =
        result.result_order_id
          ? String(result.result_order_id)
          : null;

      setSavedOrderNumber(
        Number.isFinite(orderNumber)
          ? orderNumber
          : null
      );

      setSavedOrderId(orderId);

      setSavedOrderTotal(
        Number.isFinite(orderTotal)
          ? orderTotal
          : totalAmount
      );

      setCart([]);
      setStatusMessage(
        "Sipariş başarıyla kaydedildi.",
        "success"
      );
    } catch (error) {
      console.error(
        "Beklenmeyen sipariş hatası:",
        error
      );

      setStatusMessage(
        "Sipariş kaydedilirken beklenmeyen bir hata oluştu.",
        "error"
      );
    } finally {
      if (mountedRef.current) {
        setSavingOrder(false);
      }
    }
  }

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
    setSavedOrderId(null);
    setSavedOrderTotal(null);

    setCameraError("");
    setScannerReady(false);
    setStartingScanner(false);

    setStatusMessage(
      "Yeni sipariş hazır.",
      "info"
    );
  }

  const messageClasses: Record<MessageType, string> = {
    info: "border-slate-200 bg-slate-50 text-slate-700",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    error:
      "border-red-200 bg-red-50 text-red-700",
    warning:
      "border-amber-200 bg-amber-50 text-amber-800",
  };

  if (savedOrderNumber !== null) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">
              ✓
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-wide text-emerald-600">
              Başarılı
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Sipariş Kaydedildi
            </h1>

            <p className="mt-3 text-sm text-slate-500">
              Sipariş sisteme başarıyla kaydedildi.
            </p>

            <div className="mt-8 rounded-2xl bg-slate-50 p-6">
              <p className="text-sm text-slate-500">
                Sipariş No
              </p>

              <p className="mt-1 text-4xl font-bold text-slate-950">
                #{savedOrderNumber}
              </p>

              {savedOrderTotal !== null ? (
                <>
                  <div className="mx-auto my-5 h-px max-w-xs bg-slate-200" />

                  <p className="text-sm text-slate-500">
                    Sipariş Toplamı
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {formatMoney(savedOrderTotal)}
                  </p>
                </>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void startNewOrder()}
                className="rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                + Yeni Sipariş
              </button>

              {savedOrderId ? (
                <Link
                  href={`/siparis-gecmisi/${savedOrderId}`}
                  className="rounded-xl border border-slate-200 px-5 py-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Sipariş Detayı
                </Link>
              ) : (
                <Link
                  href="/siparis-gecmisi"
                  className="rounded-xl border border-slate-200 px-5 py-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Sipariş Geçmişi
                </Link>
              )}
            </div>

            <Link
              href="/"
              className="mt-4 inline-block text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <header className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link
              href="/"
              className="transition hover:text-slate-900"
            >
              Ana Sayfa
            </Link>

            <span>›</span>

            <span className="font-medium text-slate-700">
              Sipariş Topla
            </span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Sipariş Topla
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Müşteri siparişini barkodla veya ürün arayarak hızlıca oluştur.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white sm:self-auto">
              <span>🛒</span>
              <span>{cart.length} kalem</span>
            </div>
          </div>
        </header>

        {/* STATUS */}
        {message ? (
          <div
            className={`mb-5 rounded-2xl border p-4 text-sm font-medium ${messageClasses[messageType]}`}
          >
            {message}
          </div>
        ) : null}

        {/* CUSTOMER */}
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">
              👤 Müşteri
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Siparişin hangi müşteriye ait olduğunu seç.
            </p>
          </div>

          {selectedCustomer ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-950">
                    {selectedCustomer.company_name}
                  </p>

                  {selectedCustomer.contact_name ? (
                    <p className="mt-1 text-sm text-slate-600">
                      Yetkili: {selectedCustomer.contact_name}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {selectedCustomer.phone ? (
                      <span>
                        📞 {selectedCustomer.phone}
                      </span>
                    ) : null}

                    {selectedCustomer.city ||
                    selectedCustomer.district ? (
                      <span>
                        📍 {selectedCustomer.city || ""}
                        {selectedCustomer.district
                          ? ` / ${selectedCustomer.district}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={removeSelectedCustomer}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
                >
                  Müşteriyi Değiştir
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerSearch}
                onChange={(event) =>
                  void searchCustomers(event.target.value)
                }
                placeholder="Müşteri / nalbur adı, yetkili veya telefon..."
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />

              {loadingCustomers ? (
                <div className="mt-2 text-xs font-medium text-slate-400">
                  Müşteriler aranıyor...
                </div>
              ) : null}

              {customers.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {customers.map((customer) => (
                    <button
                      type="button"
                      key={customer.id}
                      onClick={() =>
                        selectCustomer(customer)
                      }
                      className="block w-full border-b border-slate-100 p-4 text-left transition last:border-b-0 hover:bg-slate-50"
                    >
                      <p className="font-bold text-slate-950">
                        {customer.company_name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {customer.contact_name
                          ? `${customer.contact_name} • `
                          : ""}
                        {customer.phone || "Telefon yok"}
                      </p>

                      {customer.city ||
                      customer.district ? (
                        <p className="mt-1 text-xs text-slate-400">
                          📍 {customer.city || ""}
                          {customer.district
                            ? ` / ${customer.district}`
                            : ""}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {!loadingCustomers &&
              customerSearch.trim() &&
              customers.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                  Müşteri bulunamadı.
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* PRODUCT ADD */}
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">
              📦 Ürün Ekle
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Barkod okut, barkodu elle gir veya ürün adına göre ara.
            </p>
          </div>

          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void findProductByBarcode(barcode);
            }}
            className="flex flex-col gap-3 lg:flex-row"
          >
            <input
              value={barcode}
              onChange={(event) =>
                setBarcode(event.target.value)
              }
              inputMode="numeric"
              autoComplete="off"
              placeholder="Barkodu okut veya yaz..."
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3.5 font-mono text-base text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />

            <button
              type="submit"
              disabled={
                loadingProduct ||
                !barcode.trim()
              }
              className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingProduct
                ? "Aranıyor..."
                : "Ürünü Bul"}
            </button>

            {!scanning ? (
              <button
                type="button"
                onClick={() => void startScanner()}
                disabled={startingScanner}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {startingScanner
                  ? "Kamera Açılıyor..."
                  : "📷 Barkod Tara"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopScanner()}
                className="rounded-xl border border-red-200 bg-red-50 px-6 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
              >
                Kamerayı Kapat
              </button>
            )}
          </form>

          {cameraError ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              {cameraError}
            </div>
          ) : null}

          {scanning ? (
            <div className="mt-5 overflow-hidden rounded-2xl bg-black">
              <div className="relative min-h-[280px] w-full">
                <div
                  id="esora-barcode-reader"
                  className="min-h-[280px] w-full"
                />

                {!scannerReady ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/90 px-6 text-center text-white">
                    <div>
                      <div className="text-4xl">
                        📷
                      </div>

                      <p className="mt-3 font-bold">
                        Kamera açılıyor...
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        Kamera izni istenirse onayla.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-32 w-[min(80%,300px)] rounded-xl border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
                    </div>

                    <div className="absolute bottom-4 left-0 right-0 px-4 text-center text-sm font-bold text-white">
                      Barkodu çerçevenin içine getir
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </section>

        {/* PRODUCT SEARCH */}
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">
              🔎 Ürün Ara
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Ürün adı, SKU veya barkod ile arama yap.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) =>
              void searchProducts(event.target.value)
            }
            placeholder="Ürün adı, SKU veya barkod..."
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />

          {loadingProducts ? (
            <p className="mt-2 text-xs font-medium text-slate-400">
              Ürünler aranıyor...
            </p>
          ) : null}

          {products.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              {products.map((product) => {
                const stock = Number(
                  product.stock || 0
                );

                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => {
                      addToCart(product);
                      setSearch("");
                      setProducts([]);
                    }}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left transition last:border-b-0 hover:bg-slate-50"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.product_name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xl text-slate-300">
                          📦
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-950">
                        {product.product_name}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-400">
                        SKU: {product.sku || "-"} • Barkod:{" "}
                        {product.barcode || "-"}
                      </p>

                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Stok: {formatNumber(stock)}{" "}
                        {product.unit || "Adet"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-bold text-slate-950">
                        {formatMoney(
                          product.wholesale_price
                        )}
                      </p>

                      <p className="mt-1 text-xs font-medium text-slate-400">
                        Toptan
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {!loadingProducts &&
          search.trim() &&
          products.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
              Ürün bulunamadı.
            </div>
          ) : null}
        </section>

        {/* CART */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">
                Sipariş Ürünleri
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Eklenen ürünlerin miktarlarını buradan düzenleyebilirsin.
              </p>
            </div>

            {cart.length > 0 ? (
              <button
                type="button"
                onClick={clearCart}
                className="self-start text-sm font-bold text-red-500 transition hover:text-red-700 hover:underline sm:self-auto"
              >
                Siparişi Temizle
              </button>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="text-5xl">🛒</div>

              <p className="mt-4 font-bold text-slate-700">
                Henüz ürün eklenmedi
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Barkod okut veya ürün arayarak siparişe ekle.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const stock = Number(
                    item.product.stock || 0
                  );

                  const stockWarning =
                    item.quantity > stock;

                  const lineTotal =
                    item.quantity *
                    item.unitPrice;

                  return (
                    <article
                      key={item.product.id}
                      className="p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {item.product.image_url ? (
                              <img
                                src={
                                  item.product.image_url
                                }
                                alt={
                                  item.product.product_name
                                }
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-xl text-slate-300">
                                📦
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-slate-950">
                              {item.product.product_name}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              SKU:{" "}
                              {item.product.sku ||
                                "-"}{" "}
                              • Barkod:{" "}
                              {item.product.barcode ||
                                "-"}
                            </p>

                            <p className="mt-2 text-sm font-bold text-slate-700">
                              {formatMoney(
                                item.unitPrice
                              )}{" "}
                              /{" "}
                              {item.product.unit ||
                                "Adet"}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span
                                className={`text-xs font-medium ${
                                  stockWarning
                                    ? "text-red-600"
                                    : "text-slate-400"
                                }`}
                              >
                                Stok:{" "}
                                {formatNumber(
                                  stock
                                )}{" "}
                                {item.product.unit ||
                                  "Adet"}
                              </span>

                              {stockWarning ? (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                                  Stok yetersiz
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 lg:justify-end">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity - 1
                                )
                              }
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                              −
                            </button>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateQuantity(
                                  item.product.id,
                                  Number(
                                    event.target.value
                                  )
                                )
                              }
                              className="h-10 w-20 rounded-lg border border-slate-200 text-center font-bold text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity + 1
                                )
                              }
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                              +
                            </button>
                          </div>

                          <div className="min-w-[110px] text-right">
                            <p className="text-xs text-slate-400">
                              Toplam
                            </p>

                            <p className="mt-1 text-lg font-bold text-slate-950">
                              {formatMoney(lineTotal)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(
                                item.product.id
                              )
                            }
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Ürünü kaldır"
                            aria-label="Ürünü kaldır"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* TOTAL */}
              <div className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-400">
                      Ürün Kalemi
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {cart.length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-400">
                      Toplam Miktar
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {formatNumber(totalQuantity)}
                    </p>
                  </div>

                  <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-1">
                    <p className="text-xs text-slate-400">
                      Sipariş Toplamı
                    </p>

                    <p className="mt-1 text-xl font-bold text-slate-950">
                      {formatMoney(totalAmount)}
                    </p>
                  </div>
                </div>

                {stockWarningCount > 0 ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-bold">
                      ⚠️ Stok uyarısı
                    </p>

                    <p className="mt-1">
                      {stockWarningCount} üründe sipariş miktarı mevcut stoktan fazla. Sipariş kaydında sistem stok kontrolünü tekrar yapacaktır.
                    </p>
                  </div>
                ) : null}

                {!selectedCustomer ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                    Siparişi kaydetmek için önce müşteri seçmelisin.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void saveOrder()}
                  disabled={
                    savingOrder ||
                    cart.length === 0 ||
                    !selectedCustomer
                  }
                  className="mt-4 w-full rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingOrder
                    ? "Sipariş Kaydediliyor..."
                    : "💾 Siparişi Kaydet"}
                </button>
              </div>
            </>
          )}
        </section>

        <div className="h-8" />
      </div>
    </main>
  );
}

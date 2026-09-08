"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";

type OrderStatus =
  | "new"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled";

type Order = {
  id: string;
  order_number: number;
  status: OrderStatus;
  total: number;
  created_at: string;
  customer: {
    company_name: string;
  } | null;
};

type Product = {
  id: string;
  product_name: string;
  barcode: string | null;
  stock: number;
  min_stock: number;
  unit: string | null;
};

type DashboardSummary = {
  today_sales: number;
  pending_orders: number;
  total_customers: number;
  open_balance: number;
  waiting_shipments: number;
  critical_stock: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function Home() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dashboard, setDashboard] =
    useState<DashboardSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    setMobileMenuOpen(false);

    await supabase.auth.signOut();

    router.replace("/giris");
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const [
      dashboardResult,
      ordersResult,
      productsResult,
    ] = await Promise.all([
      // DASHBOARD KPI'LARI
      supabase.rpc("get_dashboard_summary"),

      // SON 6 SİPARİŞ
      supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          total,
          created_at,
          customer:customers (
            company_name
          )
        `)
        .order("created_at", {
          ascending: false,
        })
        .limit(6),

      // AKTİF ÜRÜNLER
      supabase
        .from("products")
        .select(`
          id,
          product_name,
          barcode,
          stock,
          min_stock,
          unit
        `)
        .eq("is_active", true)
        .order("product_name"),
    ]);

    const firstError =
      dashboardResult.error ||
      ordersResult.error ||
      productsResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const normalizeOrders = (
      data: any[] | null
    ): Order[] => {
      return (data || []).map((order: any) => ({
        ...order,
        customer: Array.isArray(order.customer)
          ? order.customer[0] || null
          : order.customer || null,
      }));
    };

    const dashboardData = dashboardResult.data;

    if (
      Array.isArray(dashboardData) &&
      dashboardData.length > 0
    ) {
      setDashboard({
        today_sales: Number(
          dashboardData[0].today_sales || 0
        ),
        pending_orders: Number(
          dashboardData[0].pending_orders || 0
        ),
        total_customers: Number(
          dashboardData[0].total_customers || 0
        ),
        open_balance: Number(
          dashboardData[0].open_balance || 0
        ),
        waiting_shipments: Number(
          dashboardData[0].waiting_shipments || 0
        ),
        critical_stock: Number(
          dashboardData[0].critical_stock || 0
        ),
      });
    } else {
      setDashboard({
        today_sales: 0,
        pending_orders: 0,
        total_customers: 0,
        open_balance: 0,
        waiting_shipments: 0,
        critical_stock: 0,
      });
    }

    setOrders(
      normalizeOrders(ordersResult.data)
    );

    setProducts(
      (productsResult.data || []) as Product[]
    );

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const criticalProducts = useMemo(() => {
    return products
      .filter(
        (product) =>
          Number(product.stock) <=
          Number(product.min_stock)
      )
      .sort(
        (a, b) =>
          Number(a.stock) -
          Number(b.stock)
      )
      .slice(0, 8);
  }, [products]);

  return (
    <main className="min-h-screen bg-gray-100">

      {/* ===================================================== */}
      {/* MOBİL MENÜ */}
      {/* ===================================================== */}

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={() =>
            setMobileMenuOpen(false)
          }
        >
          <aside
            className="h-full w-80 max-w-[88vw] overflow-y-auto bg-white p-5 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MOBİL MENÜ BAŞLIK */}

            <div className="mb-6 flex items-center justify-between">

              <Link
                href="/"
                onClick={() =>
                  setMobileMenuOpen(false)
                }
                className="block max-w-[190px]"
              >
                <img
                  src="/esoralogo.png"
                  alt="ESORA"
                  className="block h-auto w-full object-contain"
                />
              </Link>

              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen(false)
                }
                aria-label="Menüyü kapat"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-xl text-gray-700 transition hover:bg-gray-200"
              >
                ✕
              </button>

            </div>

            {/* ================================================= */}
            {/* HIZLI İŞLEMLER */}
            {/* ================================================= */}

            <div className="mb-5">

              <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Hızlı İşlemler
              </p>

              <div className="space-y-2">

                <MobileMenuItem
                  href="/"
                  icon="📊"
                  text="Genel Bakış"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/siparisler"
                  icon="📝"
                  text="Yeni Sipariş"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/siparis-topla"
                  icon="🛒"
                  text="Sipariş Topla"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/barkod"
                  icon="📷"
                  text="Barkod"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/musteriler"
                  icon="👥"
                  text="Müşteriler"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

              </div>

            </div>

            {/* AYIRICI */}

            <div className="my-5 border-t border-gray-200" />

            {/* ================================================= */}
            {/* SATIŞ VE SİPARİŞ */}
            {/* ================================================= */}

            <div className="mb-5">

              <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Satış ve Sipariş
              </p>

              <nav className="space-y-2">

                <MobileMenuItem
                  href="/siparisler"
                  icon="📝"
                  text="Yeni Sipariş"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/siparis-topla"
                  icon="🛒"
                  text="Sipariş Topla"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/siparis-gecmisi"
                  icon="📋"
                  text="Sipariş Geçmişi"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/sevkiyat"
                  icon="🚚"
                  text="Sevkiyat"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

              </nav>

            </div>

            {/* AYIRICI */}

            <div className="my-5 border-t border-gray-200" />

            {/* ================================================= */}
            {/* STOK VE ÜRÜNLER */}
            {/* ================================================= */}

            <div className="mb-5">

              <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Stok ve Ürünler
              </p>

              <nav className="space-y-2">

                <MobileMenuItem
                  href="/urunler"
                  icon="📦"
                  text="Ürünler"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/stok"
                  icon="📊"
                  text="Stok"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/alislar"
                  icon="📥"
                  text="Alışlar"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/tedarikciler"
                  icon="🏭"
                  text="Tedarikçiler"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/barkod"
                  icon="📷"
                  text="Barkod"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

              </nav>

            </div>

            {/* AYIRICI */}

            <div className="my-5 border-t border-gray-200" />

            {/* ================================================= */}
            {/* FİNANS */}
            {/* ================================================= */}

            <div className="mb-5">

              <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Finans
              </p>

              <nav className="space-y-2">

                <MobileMenuItem
                  href="/cari"
                  icon="💰"
                  text="Cari"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/kasa-banka"
                  icon="🏦"
                  text="Kasa-Banka"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

                <MobileMenuItem
                  href="/raporlar"
                  icon="📈"
                  text="Raporlar"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                />

              </nav>

            </div>

            {/* ================================================= */}
            {/* MOBİL ÇIKIŞ */}
            {/* ================================================= */}

            <div className="mt-8 border-t border-gray-200 pt-5">

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                <span>🚪</span>
                <span>Çıkış Yap</span>
              </button>

            </div>

          </aside>
        </div>
      )}

      <div className="flex min-h-screen">

        {/* ===================================================== */}
        {/* SOL MENÜ - MASAÜSTÜ */}
        {/* ===================================================== */}

        <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white p-5 lg:block">

          {/* ESORA LOGO */}

          <div className="mb-8 flex w-full items-center justify-center">

            <Link
              href="/"
              className="block w-full transition-opacity hover:opacity-80"
            >
              <img
                src="/esoralogo.png"
                alt="ESORA"
                className="block h-auto w-full object-contain"
              />
            </Link>

          </div>

          <nav className="space-y-2">

            <MenuItem
              href="/"
              icon="📊"
              text="Genel Bakış"
              active
            />

            <MenuItem
              href="/musteriler"
              icon="👥"
              text="Müşteriler"
            />

            <MenuItem
              href="/urunler"
              icon="📦"
              text="Ürünler"
            />

            <MenuItem
              href="/siparisler"
              icon="📝"
              text="Yeni Sipariş"
            />

            <MenuItem
              href="/siparis-gecmisi"
              icon="🛒"
              text="Siparişler"
            />

            <MenuItem
              href="/siparis-topla"
              icon="📋"
              text="Sipariş Topla"
            />

            <MenuItem
              href="/cari"
              icon="💰"
              text="Cari"
            />

            <MenuItem
              href="/kasa-banka"
              icon="🏦"
              text="Kasa-Banka"
            />

            <MenuItem
              href="/stok"
              icon="📊"
              text="Stok"
            />

            <MenuItem
              href="/alislar"
              icon="📥"
              text="Alışlar"
            />

            <MenuItem
              href="/sevkiyat"
              icon="🚚"
              text="Sevkiyat"
            />

            <MenuItem
              href="/barkod"
              icon="📷"
              text="Barkod"
            />

            <MenuItem
              href="/tedarikciler"
              icon="🏭"
              text="Tedarikçiler"
            />

            <MenuItem
              href="/raporlar"
              icon="📈"
              text="Raporlar"
            />

          </nav>

        </aside>

        {/* ===================================================== */}
        {/* ANA ALAN */}
        {/* ===================================================== */}

        <section className="min-w-0 flex-1 p-4 sm:p-5 md:p-8">

          {/* ===================================================== */}
          {/* MOBİL ÜST BAR */}
          {/* ===================================================== */}

          <div className="mb-5 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:hidden">

            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(true)
              }
              aria-label="Menüyü aç"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-2xl text-white shadow-sm transition hover:bg-gray-800"
            >
              ☰
            </button>

            <Link
              href="/"
              className="block max-w-[150px]"
            >
              <img
                src="/esoralogo.png"
                alt="ESORA"
                className="block h-auto w-full object-contain"
              />
            </Link>

            <div className="h-11 w-11" />

          </div>

          {/* ===================================================== */}
          {/* BAŞLIK */}
          {/* ===================================================== */}

          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">

            <div>

              <h2 className="text-3xl font-bold text-gray-900">
                Genel Bakış
              </h2>

              <p className="mt-1 text-gray-500">
                ESORA işletme yönetim paneline hoş geldin.
              </p>

            </div>

            <div className="flex items-center gap-3">

              <button
                onClick={loadDashboard}
                disabled={loading}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                🔄{" "}
                {loading
                  ? "Yükleniyor..."
                  : "Yenile"}
              </button>

              <button
                onClick={handleLogout}
                className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
              >
                Çıkış Yap
              </button>

            </div>

          </div>

          {/* ===================================================== */}
          {/* HATA */}
          {/* ===================================================== */}

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

              <strong>
                Dashboard verileri alınamadı:
              </strong>{" "}

              {error}

            </div>
          )}

          {/* ===================================================== */}
          {/* ÖZET KARTLARI */}
          {/* ===================================================== */}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-6">

            <DashboardCard
              icon="💰"
              title="Bugünkü Satış"
              value={
                loading
                  ? "..."
                  : formatMoney(
                      dashboard?.today_sales || 0
                    )
              }
              description="Bugün yapılan satışlar"
            />

            <DashboardCard
              icon="📦"
              title="Bekleyen Sipariş"
              value={
                loading
                  ? "..."
                  : String(
                      dashboard?.pending_orders || 0
                    )
              }
              description="Yeni veya hazırlanıyor"
            />

            <DashboardCard
              icon="👥"
              title="Toplam Müşteri"
              value={
                loading
                  ? "..."
                  : String(
                      dashboard?.total_customers || 0
                    )
              }
              description="Kayıtlı müşteriler"
            />

            <DashboardCard
              icon="💳"
              title="Açık Bakiye"
              value={
                loading
                  ? "..."
                  : formatMoney(
                      dashboard?.open_balance || 0
                    )
              }
              description="Tahsil edilmemiş cari"
            />

            <DashboardCard
              icon="🚚"
              title="Bekleyen Sevkiyat"
              value={
                loading
                  ? "..."
                  : String(
                      dashboard?.waiting_shipments || 0
                    )
              }
              description="Hazırlanan veya sevk edilen"
            />

            <DashboardCard
              icon="⚠️"
              title="Kritik Stok"
              value={
                loading
                  ? "..."
                  : String(
                      dashboard?.critical_stock || 0
                    )
              }
              description="Minimum seviyede ürün"
            />

          </div>

          {/* ===================================================== */}
          {/* ALT ALAN */}
          {/* ===================================================== */}

          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">

            {/* SON SİPARİŞLER */}

            <div className="rounded-2xl border border-gray-200 bg-white p-6 xl:col-span-2">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="text-lg font-semibold text-gray-900">
                    Son Siparişler
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Sistemdeki son siparişler
                  </p>

                </div>

                <Link
                  href="/siparis-gecmisi"
                  className="text-sm font-semibold text-gray-700 hover:underline"
                >
                  Tümünü Gör →
                </Link>

              </div>

              <div className="mt-6">

                {loading ? (

                  <div className="py-8 text-center text-sm text-gray-500">
                    Siparişler yükleniyor...
                  </div>

                ) : orders.length === 0 ? (

                  <div className="py-8 text-center text-sm text-gray-500">
                    Henüz sipariş bulunmuyor.
                  </div>

                ) : (

                  <div className="divide-y divide-gray-100">

                    {orders.map((order) => (

                      <Link
                        key={order.id}
                        href={`/siparis-gecmisi/${order.id}`}
                        className="flex flex-col gap-3 py-4 transition hover:bg-gray-50 md:flex-row md:items-center md:justify-between"
                      >

                        <div className="flex items-center gap-4">

                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                            🛒
                          </div>

                          <div>

                            <p className="font-semibold text-gray-900">
                              Sipariş #{order.order_number}
                            </p>

                            <p className="text-sm text-gray-500">
                              {order.customer?.company_name ||
                                "Müşteri bulunamadı"}
                            </p>

                          </div>

                        </div>

                        <div className="flex items-center gap-4 md:text-right">

                          <div>

                            <p className="font-semibold text-gray-900">
                              {formatMoney(
                                Number(
                                  order.total || 0
                                )
                              )}
                            </p>

                            <p className="text-xs text-gray-400">
                              {formatDate(
                                order.created_at
                              )}
                            </p>

                          </div>

                          <StatusBadge
                            status={order.status}
                          />

                        </div>

                      </Link>

                    ))}

                  </div>

                )}

              </div>

            </div>

            {/* KRİTİK STOK */}

            <div className="rounded-2xl border border-gray-200 bg-white p-6">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="text-lg font-semibold text-gray-900">
                    Kritik Stoklar
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Minimum seviyedeki ürünler
                  </p>

                </div>

                <Link
                  href="/stok"
                  className="text-sm font-semibold text-gray-700 hover:underline"
                >
                  Stok →
                </Link>

              </div>

              <div className="mt-6">

                {loading ? (

                  <div className="py-8 text-center text-sm text-gray-500">
                    Stoklar yükleniyor...
                  </div>

                ) : criticalProducts.length === 0 ? (

                  <div className="rounded-xl bg-gray-50 p-6 text-center">

                    <div className="text-3xl">
                      ✅
                    </div>

                    <p className="mt-3 text-sm font-medium text-gray-700">
                      Kritik stok bulunmuyor.
                    </p>

                  </div>

                ) : (

                  <div className="space-y-3">

                    {criticalProducts.map(
                      (product) => (

                        <Link
                          key={product.id}
                          href="/stok"
                          className="block rounded-xl border border-gray-100 p-4 transition hover:bg-gray-50"
                        >

                          <div className="flex items-start justify-between gap-3">

                            <div className="min-w-0">

                              <p className="truncate text-sm font-semibold text-gray-900">
                                {product.product_name}
                              </p>

                              {product.barcode && (
                                <p className="mt-1 text-xs text-gray-400">
                                  Barkod:{" "}
                                  {product.barcode}
                                </p>
                              )}

                            </div>

                            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                              {Number(
                                product.stock
                              )}{" "}
                              {product.unit ||
                                "Adet"}
                            </span>

                          </div>

                          <p className="mt-2 text-xs text-gray-500">
                            Minimum stok:{" "}
                            {Number(
                              product.min_stock
                            )}
                          </p>

                        </Link>

                      )
                    )}

                  </div>

                )}

              </div>

            </div>

          </div>

          {/* ===================================================== */}
          {/* ALT BİLGİ */}
          {/* ===================================================== */}

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">

            <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">

              <div>

                <p className="text-sm font-semibold text-gray-900">
                  ESORA Yönetim Sistemi
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  İşletmenin sipariş, stok, cari ve
                  sevkiyat süreçlerini tek merkezden
                  yönet.
                </p>

              </div>

              <p className="text-xs text-gray-400">
                Sistem aktif • Supabase bağlantısı hazır
              </p>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}

/* ========================================================= */
/* MASAÜSTÜ MENÜ ITEM */
/* ========================================================= */

function MenuItem({
  href,
  icon,
  text,
  active = false,
}: {
  href: string;
  icon: string;
  text: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
        active
          ? "bg-gray-900 text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <span>{icon}</span>
      <span>{text}</span>
    </Link>
  );
}

/* ========================================================= */
/* MOBİL MENÜ ITEM */
/* ========================================================= */

function MobileMenuItem({
  href,
  icon,
  text,
  onClick,
}: {
  href: string;
  icon: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 active:bg-gray-100"
    >
      <span className="flex w-7 items-center justify-center text-lg">
        {icon}
      </span>

      <span>{text}</span>
    </Link>
  );
}

/* ========================================================= */
/* DASHBOARD CARD */
/* ========================================================= */

function DashboardCard({
  icon,
  title,
  value,
  description,
}: {
  icon: string;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

      <div className="flex items-center justify-between">

        <p className="text-sm font-medium text-gray-500">
          {title}
        </p>

        <span className="text-xl">
          {icon}
        </span>

      </div>

      <p className="mt-3 text-2xl font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-2 text-xs text-gray-400">
        {description}
      </p>

    </div>
  );
}

/* ========================================================= */
/* SİPARİŞ DURUMU */
/* ========================================================= */

function StatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const config: Record<
    OrderStatus,
    {
      label: string;
      className: string;
    }
  > = {
    new: {
      label: "Yeni",
      className:
        "bg-gray-100 text-gray-700",
    },

    preparing: {
      label: "Hazırlanıyor",
      className:
        "bg-yellow-100 text-yellow-800",
    },

    shipped: {
      label: "Sevk Edildi",
      className:
        "bg-blue-100 text-blue-800",
    },

    completed: {
      label: "Tamamlandı",
      className:
        "bg-green-100 text-green-800",
    },

    cancelled: {
      label: "İptal",
      className:
        "bg-red-100 text-red-800",
    },
  };

  const item = config[status];

  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}


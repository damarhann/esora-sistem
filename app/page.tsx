"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";

type OrderStatus =
  | "new"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled";

type OrderCustomer = {
  company_name: string;
};

type Order = {
  id: string;
  order_number: number;
  status: OrderStatus;
  total: number;
  created_at: string;
  customer: OrderCustomer | null;
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

type CashAccount = {
  id: string;
  name: string;
  balance: number | null;
  is_active: boolean;
};

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  balance: number | null;
  is_active: boolean;
};

type RawOrder = {
  id: string;
  order_number: number;
  status: string;
  total: number | null;
  created_at: string;
  customer:
    | OrderCustomer
    | OrderCustomer[]
    | null;
};

type DashboardRpcRow = {
  today_sales?: number | string | null;
  pending_orders?: number | string | null;
  total_customers?: number | string | null;
  open_balance?: number | string | null;
  waiting_shipments?: number | string | null;
  critical_stock?: number | string | null;
};

type NavigationItem = {
  href: string;
  label: string;
  icon: string;
};

type NavigationGroup = {
  title: string;
  icon: string;
  items: NavigationItem[];
};

const ORDER_STATUSES: Record<OrderStatus, string> = {
  new: "Yeni",
  preparing: "Hazırlanıyor",
  shipped: "Sevk Edildi",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const EMPTY_DASHBOARD: DashboardSummary = {
  today_sales: 0,
  pending_orders: 0,
  total_customers: 0,
  open_balance: 0,
  waiting_shipments: 0,
  critical_stock: 0,
};

const SIDEBAR_GROUPS: NavigationGroup[] = [
  {
    title: "Satış",
    icon: "🛍️",
    items: [
      {
        href: "/siparisler",
        label: "Yeni Sipariş",
        icon: "📝",
      },
      {
        href: "/siparis-gecmisi",
        label: "Siparişler",
        icon: "📋",
      },
      {
        href: "/siparis-topla",
        label: "Sipariş Topla",
        icon: "🛒",
      },
      {
        href: "/sevkiyat",
        label: "Sevkiyat",
        icon: "🚚",
      },
    ],
  },
  {
    title: "Ürün & Stok",
    icon: "📦",
    items: [
      {
        href: "/urunler",
        label: "Ürünler",
        icon: "📦",
      },
      {
        href: "/stok",
        label: "Stok",
        icon: "📊",
      },
      {
        href: "/barkod",
        label: "Barkod",
        icon: "📷",
      },
      {
        href: "/alislar",
        label: "Alışlar",
        icon: "📥",
      },
    ],
  },
  {
    title: "Cari & Finans",
    icon: "💰",
    items: [
      {
        href: "/musteriler",
        label: "Müşteriler",
        icon: "👥",
      },
      {
        href: "/cari",
        label: "Cari",
        icon: "💰",
      },
      {
        href: "/kasa-banka",
        label: "Kasa & Banka",
        icon: "🏦",
      },
      {
        href: "/tedarikciler",
        label: "Tedarikçiler",
        icon: "🏭",
      },
    ],
  },
  {
    title: "Yönetim",
    icon: "📈",
    items: [
      {
        href: "/raporlar",
        label: "Raporlar",
        icon: "📈",
      },
    ],
  },
];

const QUICK_ACTIONS: NavigationItem[] = [
  {
    href: "/siparisler",
    label: "Yeni Sipariş",
    icon: "📝",
  },
  {
    href: "/siparis-topla",
    label: "Sipariş Topla",
    icon: "🛒",
  },
  {
    href: "/musteriler",
    label: "Müşteri Ekle",
    icon: "👥",
  },
  {
    href: "/urunler",
    label: "Ürünler",
    icon: "📦",
  },
  {
    href: "/stok",
    label: "Stok",
    icon: "📊",
  },
  {
    href: "/sevkiyat",
    label: "Sevkiyat",
    icon: "🚚",
  },
  {
    href: "/cari",
    label: "Cari",
    icon: "💰",
  },
  {
    href: "/raporlar",
    label: "Raporlar",
    icon: "📈",
  },
];

function isOrderStatus(value: string): value is OrderStatus {
  return (
    value === "new" ||
    value === "preparing" ||
    value === "shipped" ||
    value === "completed" ||
    value === "cancelled"
  );
}

function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeCustomer(
  value: OrderCustomer | OrderCustomer[] | null
): OrderCustomer | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function normalizeOrders(
  rows: RawOrder[] | null | undefined
): Order[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  const normalized: Order[] = [];

  for (const row of rows) {
    if (!isOrderStatus(row.status)) {
      continue;
    }

    normalized.push({
      id: row.id,
      order_number: Number(row.order_number),
      status: row.status,
      total: toNumber(row.total),
      created_at: row.created_at,
      customer: normalizeCustomer(row.customer),
    });
  }

  return normalized;
}

function isActivePath(
  pathname: string,
  href: string
): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [dashboard, setDashboard] =
    useState<DashboardSummary>(EMPTY_DASHBOARD);

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cashAccounts, setCashAccounts] =
    useState<CashAccount[]>([]);
  const [bankAccounts, setBankAccounts] =
    useState<BankAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [desktopGroupsOpen, setDesktopGroupsOpen] =
    useState<Record<string, boolean>>({
      Satış: true,
      "Ürün & Stok": false,
      "Cari & Finans": false,
      Yönetim: false,
    });

  const [mobileGroupsOpen, setMobileGroupsOpen] =
    useState<Record<string, boolean>>({
      Satış: true,
      "Ürün & Stok": false,
      "Cari & Finans": false,
      Yönetim: false,
    });

  const requestIdRef = useRef(0);

  const loadDashboard = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError("");

    try {
      const [
        dashboardResult,
        ordersResult,
        productsResult,
        cashResult,
        bankResult,
      ] = await Promise.all([
        supabase.rpc("get_dashboard_summary"),

        supabase
          .from("orders")
          .select(
            `
              id,
              order_number,
              status,
              total,
              created_at,
              customer:customers (
                company_name
              )
            `
          )
          .neq("status", "cancelled")
          .order("created_at", {
            ascending: false,
          })
          .limit(6),

        supabase
          .from("products")
          .select(
            "id, product_name, barcode, stock, min_stock, unit"
          )
          .eq("is_active", true)
          .order("product_name", {
            ascending: true,
          }),

        supabase
          .from("cash_accounts")
          .select(
            "id, name, balance, is_active"
          )
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("bank_accounts")
          .select(
            "id, bank_name, account_name, balance, is_active"
          )
          .eq("is_active", true)
          .order("bank_name", {
            ascending: true,
          }),
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      const criticalErrors: string[] = [];

      if (dashboardResult.error) {
        criticalErrors.push(
          `Dashboard özeti alınamadı: ${dashboardResult.error.message}`
        );
      }

      if (ordersResult.error) {
        criticalErrors.push(
          `Siparişler alınamadı: ${ordersResult.error.message}`
        );
      }

      if (productsResult.error) {
        criticalErrors.push(
          `Ürünler alınamadı: ${productsResult.error.message}`
        );
      }

      if (criticalErrors.length > 0) {
        setError(criticalErrors.join(" | "));
        return;
      }

      const dashboardRows =
        (dashboardResult.data ?? []) as DashboardRpcRow[];

      const dashboardRow = dashboardRows[0];

      const nextDashboard: DashboardSummary = {
        today_sales: toNumber(
          dashboardRow?.today_sales
        ),
        pending_orders: toNumber(
          dashboardRow?.pending_orders
        ),
        total_customers: toNumber(
          dashboardRow?.total_customers
        ),
        open_balance: toNumber(
          dashboardRow?.open_balance
        ),
        waiting_shipments: toNumber(
          dashboardRow?.waiting_shipments
        ),
        critical_stock: toNumber(
          dashboardRow?.critical_stock
        ),
      };

      const normalizedOrders = normalizeOrders(
        (ordersResult.data ?? []) as RawOrder[]
      );

      const normalizedProducts =
        (productsResult.data ?? []) as Product[];

      const normalizedCash =
        (cashResult.data ?? []) as CashAccount[];

      const normalizedBank =
        (bankResult.data ?? []) as BankAccount[];

      setDashboard(nextDashboard);
      setOrders(normalizedOrders);
      setProducts(normalizedProducts);
      setCashAccounts(normalizedCash);
      setBankAccounts(normalizedBank);
      setLastUpdated(new Date().toISOString());

      const supportiveErrors: string[] = [];

      if (cashResult.error) {
        supportiveErrors.push(
          `Kasa bilgileri alınamadı: ${cashResult.error.message}`
        );
      }

      if (bankResult.error) {
        supportiveErrors.push(
          `Banka bilgileri alınamadı: ${bankResult.error.message}`
        );
      }

      if (supportiveErrors.length > 0) {
        setError(supportiveErrors.join(" | "));
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Dashboard yüklenirken beklenmeyen bir hata oluştu."
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const criticalProducts = useMemo(() => {
    return products
      .filter(
        (product) =>
          product.stock <= product.min_stock
      )
      .sort((a, b) => a.stock - b.stock);
  }, [products]);

  const totalCash = useMemo(() => {
    return cashAccounts.reduce(
      (sum, account) =>
        sum + toNumber(account.balance),
      0
    );
  }, [cashAccounts]);

  const totalBank = useMemo(() => {
    return bankAccounts.reduce(
      (sum, account) =>
        sum + toNumber(account.balance),
      0
    );
  }, [bankAccounts]);

  const totalLiquidity = useMemo(() => {
    return totalCash + totalBank;
  }, [totalCash, totalBank]);

  const toggleDesktopGroup = (
    title: string
  ) => {
    setDesktopGroupsOpen((current) => ({
      ...current,
      [title]: !current[title],
    }));
  };

  const toggleMobileGroup = (
    title: string
  ) => {
    setMobileGroupsOpen((current) => ({
      ...current,
      [title]: !current[title],
    }));
  };

  const handleLogout = async () => {
    setError("");

    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setError(
        `Çıkış yapılamadı: ${logoutError.message}`
      );
      return;
    }

    router.replace("/giris");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() =>
              setMobileMenuOpen(false)
            }
          />

          <aside className="relative flex h-full w-[290px] max-w-[88vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
              <div>
                <div className="flex items-center">
  <img
    src="/esoralogo.png"
    alt="ESORA"
    className="h-10 w-auto object-contain"
  />
</div>
              </div>

              <button
                type="button"
                aria-label="Menüyü kapat"
                onClick={() =>
                  setMobileMenuOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                ×
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <Link
                href="/"
                onClick={() =>
                  setMobileMenuOpen(false)
                }
                className={`mb-3 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  isActivePath(pathname, "/")
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="text-base">
                  🏠
                </span>
                <span>Genel Bakış</span>
              </Link>

              <div className="space-y-2">
                {SIDEBAR_GROUPS.map((group) => (
                  <MobileMenuSection
                    key={group.title}
                    group={group}
                    open={
                      mobileGroupsOpen[
                        group.title
                      ] ?? false
                    }
                    onToggle={() =>
                      toggleMobileGroup(
                        group.title
                      )
                    }
                    pathname={pathname}
                    onNavigate={() =>
                      setMobileMenuOpen(false)
                    }
                  />
                ))}
              </div>
            </nav>

            <div className="border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                <span>🚪</span>
                <span>Çıkış Yap</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-5">
          <div>
            <div className="flex items-center">
  <img
    src="/esoralogo.png"
    alt="ESORA"
    className="h-10 w-auto object-contain"
  />
</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <Link
            href="/"
            className={`mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActivePath(pathname, "/")
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>🏠</span>
            <span>Genel Bakış</span>
          </Link>

          <div className="space-y-3">
            {SIDEBAR_GROUPS.map((group) => (
              <DesktopMenuSection
                key={group.title}
                group={group}
                open={
                  desktopGroupsOpen[
                    group.title
                  ] ?? false
                }
                onToggle={() =>
                  toggleDesktopGroup(
                    group.title
                  )
                }
                pathname={pathname}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <span>🚪</span>
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="min-h-screen lg:pl-60">
        {/* MOBILE TOP BAR */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            aria-label="Menüyü aç"
            onClick={() =>
              setMobileMenuOpen(true)
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl shadow-sm transition hover:bg-slate-50"
          >
            ☰
          </button>

          <div className="text-center">
            <div className="text-base font-black tracking-tight">
              ESORA
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Yönetim
            </div>
          </div>

          <button
            type="button"
            aria-label="Yenile"
            onClick={() =>
              void loadDashboard()
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg shadow-sm transition hover:bg-slate-50"
          >
            ↻
          </button>
        </div>

        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {/* HEADER */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                ESORA ARMATÜR
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Genel Bakış
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                İşletmenizin güncel durumunu buradan takip edin.
              </p>

              {lastUpdated && (
                <p className="mt-2 text-xs text-slate-400">
                  Son güncelleme:{" "}
                  {formatTime(lastUpdated)}
                </p>
              )}
            </div>

            <div className="hidden items-center gap-2 sm:flex">
  <button
    type="button"
    onClick={() =>
      void loadDashboard()
    }
    disabled={loading}
    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
  >
    <span
      className={
        loading
          ? "animate-spin"
          : ""
      }
    >
      ↻
    </span>
    Yenile
  </button>
</div>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="self-end rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100 sm:self-auto"
              >
                Kapat
              </button>
            </div>
          )}

          {/* KPI CARDS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DashboardCard
              title="Bugünkü Satış"
              value={formatMoney(
                dashboard.today_sales
              )}
              icon="💰"
              description="Bugün gerçekleşen satışlar"
              loading={loading}
            />

            <DashboardCard
              title="Bekleyen Sipariş"
              value={String(
                dashboard.pending_orders
              )}
              icon="📦"
              description="Hazırlanmayı bekleyen siparişler"
              loading={loading}
            />

            <DashboardCard
              title="Toplam Müşteri"
              value={String(
                dashboard.total_customers
              )}
              icon="👥"
              description="Aktif müşteriler"
              loading={loading}
            />

            <DashboardCard
              title="Açık Cari"
              value={formatMoney(
                dashboard.open_balance
              )}
              icon="📒"
              description="Müşterilerden alınacak toplam"
              loading={loading}
            />

            <DashboardCard
              title="Bekleyen Sevkiyat"
              value={String(
                dashboard.waiting_shipments
              )}
              icon="🚚"
              description="Sevk edilmeyi bekleyen siparişler"
              loading={loading}
            />

            <DashboardCard
              title="Kritik Stok"
              value={String(
                dashboard.critical_stock
              )}
              icon="⚠️"
              description="Minimum stok seviyesinin altındaki ürünler"
              loading={loading}
            />
          </div>

          {/* FINANCE SUMMARY */}
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Finans Özeti
                </h2>
                <p className="text-xs text-slate-500">
                  Güncel kasa ve banka bakiyeleri
                </p>
              </div>

              <Link
                href="/kasa-banka"
                className="text-xs font-bold text-slate-600 transition hover:text-slate-900"
              >
                Detay →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FinanceSummaryCard
                title="Toplam Kasa"
                value={totalCash}
                icon="💵"
                loading={loading}
              />

              <FinanceSummaryCard
                title="Toplam Banka"
                value={totalBank}
                icon="🏦"
                loading={loading}
              />

              <FinanceSummaryCard
                title="Toplam Likidite"
                value={totalLiquidity}
                icon="💳"
                loading={loading}
                emphasized
              />
            </div>
          </section>

          {/* RECENT ORDERS + CRITICAL STOCK */}
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Son Siparişler
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Son oluşturulan aktif siparişler
                  </p>
                </div>

                <Link
                  href="/siparis-gecmisi"
                  className="text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Tümü →
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {loading && orders.length === 0 ? (
                  <div className="space-y-3 p-5">
                    {[1, 2, 3].map(
                      (item) => (
                        <div
                          key={item}
                          className="animate-pulse rounded-xl bg-slate-100 p-4"
                        >
                          <div className="h-4 w-1/3 rounded bg-slate-200" />
                          <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
                        </div>
                      )
                    )}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <div className="text-3xl">
                      📋
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Henüz sipariş bulunmuyor.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      İlk siparişinizi oluşturabilirsiniz.
                    </p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/siparis-gecmisi/${order.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            #{order.order_number}
                          </span>

                          <StatusBadge
                            status={order.status}
                          />
                        </div>

                        <div className="mt-1 truncate text-sm text-slate-600">
                          {order.customer
                            ?.company_name ??
                            "Müşteri bilgisi yok"}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {formatDate(
                            order.created_at
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="font-bold text-slate-900">
                          {formatMoney(
                            order.total
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Detay →
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Kritik Stok
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Minimum seviyeye ulaşan ürünler
                  </p>
                </div>

                <Link
                  href="/stok"
                  className="text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Stok →
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {loading &&
                criticalProducts.length === 0 ? (
                  <div className="space-y-3 p-5">
                    {[1, 2, 3].map(
                      (item) => (
                        <div
                          key={item}
                          className="animate-pulse rounded-xl bg-slate-100 p-4"
                        >
                          <div className="h-4 w-1/2 rounded bg-slate-200" />
                          <div className="mt-2 h-3 w-1/3 rounded bg-slate-200" />
                        </div>
                      )
                    )}
                  </div>
                ) : criticalProducts.length ===
                  0 ? (
                  <div className="px-5 py-12 text-center">
                    <div className="text-3xl">
                      ✅
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Kritik stok bulunmuyor.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Tüm ürünler minimum stok seviyesinin üzerinde.
                    </p>
                  </div>
                ) : (
                  criticalProducts
                    .slice(0, 6)
                    .map((product) => (
                      <Link
                        key={product.id}
                        href="/stok"
                        className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">
                            {product.product_name}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {product.barcode
                              ? `Barkod: ${product.barcode}`
                              : "Barkod yok"}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="font-black text-red-600">
                            {product.stock}
                            {product.unit
                              ? ` ${product.unit}`
                              : ""}
                          </div>

                          <div className="mt-1 text-[11px] text-slate-400">
                            Min:{" "}
                            {product.min_stock}
                          </div>
                        </div>
                      </Link>
                    ))
                )}
              </div>
            </section>
          </div>

          {/* QUICK ACCESS */}
          <section className="mt-6">
            <div className="mb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Hızlı Erişim
              </h2>
              <p className="text-xs text-slate-500">
                En sık kullandığınız işlemlere hızlıca ulaşın.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {QUICK_ACTIONS.map(
                (action) => (
                  <QuickAction
                    key={action.href}
                    href={action.href}
                    icon={action.icon}
                    label={action.label}
                  />
                )
              )}
            </div>
          </section>

          {/* FOOTER */}
          <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
            ESORA Yönetim Sistemi
          </footer>
        </div>
      </main>
    </div>
  );
}

function DesktopMenuSection({
  group,
  open,
  onToggle,
  pathname,
}: {
  group: NavigationGroup;
  open: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-50"
      >
        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
          <span className="text-sm normal-case">
            {group.icon}
          </span>
          {group.title}
        </span>

        <span className="text-sm font-bold text-slate-400">
          {open ? "⌄" : "›"}
        </span>
      </button>

      {open && (
        <div className="mt-1 space-y-0.5">
          {group.items.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              pathname={pathname}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MobileMenuSection({
  group,
  open,
  onToggle,
  pathname,
  onNavigate,
}: {
  group: NavigationGroup;
  open: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <span className="text-base normal-case">
            {group.icon}
          </span>
          {group.title}
        </span>

        <span className="text-base font-bold text-slate-400">
          {open ? "⌄" : "›"}
        </span>
      </button>

      {open && (
        <div className="space-y-1 px-2 pb-2">
          {group.items.map((item) => (
            <MobileMenuItem
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SidebarLink({
  item,
  pathname,
}: {
  item: NavigationItem;
  pathname: string;
}) {
  const active = isActivePath(
    pathname,
    item.href
  );

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span className="w-5 text-center text-sm">
        {item.icon}
      </span>

      <span>{item.label}</span>
    </Link>
  );
}

function MobileMenuItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isActivePath(
    pathname,
    item.href
  );

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-700 hover:bg-white"
      }`}
    >
      <span className="w-5 text-center">
        {item.icon}
      </span>

      <span>{item.label}</span>
    </Link>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[96px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <span className="text-2xl transition group-hover:scale-110">
        {icon}
      </span>

      <span className="mt-2 text-xs font-bold text-slate-700">
        {label}
      </span>
    </Link>
  );
}

function DashboardCard({
  title,
  value,
  icon,
  description,
  loading,
}: {
  title: string;
  value: string;
  icon: string;
  description: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
            {title}
          </p>

          <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">
            {loading ? (
              <span className="inline-block h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              value
            )}
          </div>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

function FinanceSummaryCard({
  title,
  value,
  icon,
  loading,
  emphasized = false,
}: {
  title: string;
  value: number;
  icon: string;
  loading: boolean;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        emphasized
          ? "border-slate-300"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
            {title}
          </p>

          <div className="mt-2 text-xl font-black text-slate-900">
            {loading ? (
              <span className="inline-block h-7 w-32 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              formatMoney(value)
            )}
          </div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const styles: Record<OrderStatus, string> = {
    new: "bg-blue-50 text-blue-700",
    preparing:
      "bg-amber-50 text-amber-700",
    shipped:
      "bg-purple-50 text-purple-700",
    completed:
      "bg-emerald-50 text-emerald-700",
    cancelled:
      "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-bold ${styles[status]}`}
    >
      {ORDER_STATUSES[status]}
    </span>
  );
}
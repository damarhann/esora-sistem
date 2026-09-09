"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  stock: number;
  min_stock: number;
  unit: string | null;
};

type StockMovement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  stock_before: number | null;
  stock_after: number | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
  products?: {
    product_name: string;
    barcode: string | null;
  } | null;
};

type OrderInfo = {
  id: string;
  order_number: number;
};

const movementLabels: Record<string, string> = {
  purchase: "Stok Girişi",
  purchase_cancel: "Alış İptali",
  sale: "Satış",
  sale_cancel: "Satış İptali",
  return: "İade",
  adjustment_in: "Stok Girişi",
  adjustment_out: "Stok Çıkışı",
  damage: "Hasarlı Ürün",
  count: "Sayım",
};

const movementIcons: Record<string, string> = {
  purchase: "📥",
  purchase_cancel: "📤",
  sale: "📤",
  sale_cancel: "📥",
  return: "↩️",
  adjustment_in: "➕",
  adjustment_out: "➖",
  damage: "🗑️",
  count: "📊",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

function getMovementClass(type: string) {
  if (
    type === "purchase" ||
    type === "return" ||
    type === "adjustment_in" ||
    type === "sale_cancel"
  ) {
    return "text-green-600";
  }

  if (
    type === "sale" ||
    type === "purchase_cancel" ||
    type === "adjustment_out" ||
    type === "damage"
  ) {
    return "text-red-600";
  }

  return "text-blue-600";
}

/**
 * Stok hareketindeki gerçek DB miktarını gösterir.
 *
 * Önemli:
 * stock_movements.quantity alanı hareketin gerçek
 * stok değişimini tutar.
 *
 * Örnek:
 *  +10 => stok 750 -> 760
 *  -10 => stok 760 -> 750
 *
 * Bu nedenle purchase_cancel gibi hareketleri
 * varsayılan olarak "+" yapmıyoruz.
 */
function getMovementQuantity(
  type: string,
  quantity: number
) {
  const value = Number(quantity || 0);

  if (!Number.isFinite(value)) {
    return "0";
  }

  if (value > 0) {
    return `+${formatNumber(value)}`;
  }

  if (value < 0) {
    return `-${formatNumber(Math.abs(value))}`;
  }

  return "0";
}

/**
 * Geçmişte özellikle sayım hareketinin miktarı,
 * RPC tarafından stok farkı olarak kaydediliyor.
 *
 * Yine de stock_before / stock_after mevcutsa
 * gerçek farkı esas alıyoruz.
 */
function getHistoryQuantity(movement: StockMovement) {
  if (
    movement.movement_type === "count" &&
    movement.stock_before !== null &&
    movement.stock_after !== null
  ) {
    const difference =
      Number(movement.stock_after) -
      Number(movement.stock_before);

    if (difference > 0) {
      return `+${formatNumber(difference)}`;
    }

    if (difference < 0) {
      return `-${formatNumber(Math.abs(difference))}`;
    }

    return "0";
  }

  return getMovementQuantity(
    movement.movement_type,
    Number(movement.quantity || 0)
  );
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<OrderInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [movementType, setMovementType] =
    useState("purchase");

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const [historyProduct, setHistoryProduct] =
    useState<Product | null>(null);

  const [historyMovements, setHistoryMovements] =
    useState<StockMovement[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  async function loadData(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setLoadError("");

    const [
      productsResult,
      movementsResult,
      ordersResult,
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, product_name, sku, barcode, category, stock, min_stock, unit"
        )
        .eq("is_active", true)
        .order("product_name", {
          ascending: true,
        }),

      supabase
        .from("stock_movements")
        .select(
          `
          id,
          product_id,
          movement_type,
          quantity,
          stock_before,
          stock_after,
          reference_id,
          note,
          created_at,
          products (
            product_name,
            barcode
          )
        `
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(100),

      supabase
        .from("orders")
        .select("id, order_number")
        .order("order_number", {
          ascending: false,
        }),
    ]);

    const errors = [
      productsResult.error,
      movementsResult.error,
      ordersResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error(
        "Stok verileri yüklenirken hata:",
        errors
      );

      setLoadError(
        "Stok verileri yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
      );
    }

    setProducts(
      (productsResult.data || []) as Product[]
    );

    setMovements(
      (movementsResult.data || []) as unknown as StockMovement[]
    );

    setOrders(
      (ordersResult.data || []) as OrderInfo[]
    );

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const orderMap = useMemo(() => {
    const map: Record<string, number> = {};

    orders.forEach((order) => {
      map[order.id] = order.order_number;
    });

    return map;
  }, [orders]);

  const filteredProducts = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase("tr-TR");

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.product_name
          .toLocaleLowerCase("tr-TR")
          .includes(query) ||
        (product.sku || "")
          .toLocaleLowerCase("tr-TR")
          .includes(query) ||
        (product.barcode || "")
          .toLocaleLowerCase("tr-TR")
          .includes(query) ||
        (product.category || "")
          .toLocaleLowerCase("tr-TR")
          .includes(query);

      const matchesFilter =
        !productFilter ||
        product.id === productFilter;

      return matchesSearch && matchesFilter;
    });
  }, [products, search, productFilter]);

  const totalStock = useMemo(() => {
    return products.reduce(
      (sum, product) =>
        sum + Number(product.stock || 0),
      0
    );
  }, [products]);

  const criticalStock = useMemo(() => {
    return products.filter(
      (product) =>
        Number(product.stock || 0) <=
        Number(product.min_stock || 0)
    ).length;
  }, [products]);

  const outOfStock = useMemo(() => {
    return products.filter(
      (product) =>
        Number(product.stock || 0) <= 0
    ).length;
  }, [products]);

  const selectedProduct = products.find(
    (product) =>
      product.id === selectedProductId
  );

  const enteredQuantity =
    quantity.trim() === ""
      ? NaN
      : Number(quantity);

  const previewStock = useMemo(() => {
    if (
      !selectedProduct ||
      Number.isNaN(enteredQuantity)
    ) {
      return null;
    }

    const current =
      Number(selectedProduct.stock || 0);

    if (movementType === "count") {
      return enteredQuantity;
    }

    if (
      movementType === "adjustment_out" ||
      movementType === "damage"
    ) {
      return current - enteredQuantity;
    }

    return current + enteredQuantity;
  }, [
    selectedProduct,
    movementType,
    enteredQuantity,
  ]);

  const isQuantityValid =
    quantity.trim() !== "" &&
    Number.isFinite(enteredQuantity) &&
    enteredQuantity >= 0 &&
    (
      movementType === "count"
        ? true
        : enteredQuantity > 0
    );

  function openModal() {
    setMovementType("purchase");
    setSelectedProductId("");
    setQuantity("");
    setNote("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
  }

  async function openStockHistory(product: Product) {
    setHistoryProduct(product);
    setHistoryMovements([]);
    setHistoryLoading(true);

    const { data, error } = await supabase
      .from("stock_movements")
      .select(
        `
        id,
        product_id,
        movement_type,
        quantity,
        stock_before,
        stock_after,
        reference_id,
        note,
        created_at,
        products (
          product_name,
          barcode
        )
      `
      )
      .eq("product_id", product.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Stok geçmişi yüklenirken hata:",
        error
      );

      alert(
        error.message ||
          "Stok geçmişi yüklenirken hata oluştu."
      );

      setHistoryLoading(false);
      return;
    }

    setHistoryMovements(
      (data || []) as unknown as StockMovement[]
    );

    setHistoryLoading(false);
  }

  function closeStockHistory() {
    if (historyLoading) return;

    setHistoryProduct(null);
    setHistoryMovements([]);
  }

  async function saveMovement() {
    if (!selectedProductId) {
      alert("Lütfen ürün seçin.");
      return;
    }

    if (
      quantity.trim() === "" ||
      !Number.isFinite(enteredQuantity)
    ) {
      alert(
        movementType === "count"
          ? "Lütfen sayım miktarını girin."
          : "Lütfen geçerli bir miktar girin."
      );
      return;
    }

    // Sayımda 0 geçerlidir.
    if (movementType === "count") {
      if (enteredQuantity < 0) {
        alert(
          "Sayım miktarı 0 veya daha büyük olmalıdır."
        );
        return;
      }
    } else {
      if (enteredQuantity <= 0) {
        alert(
          "Miktar 0'dan büyük olmalıdır."
        );
        return;
      }
    }

    if (
      movementType !== "count" &&
      selectedProduct &&
      (
        movementType === "adjustment_out" ||
        movementType === "damage"
      ) &&
      enteredQuantity >
        Number(selectedProduct.stock || 0)
    ) {
      alert(
        `Yetersiz stok. Mevcut stok: ${formatNumber(
          Number(selectedProduct.stock || 0)
        )}`
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc(
      "adjust_stock",
      {
        p_product_id: selectedProductId,
        p_movement_type: movementType,
        p_quantity: enteredQuantity,
        p_note: note.trim() || null,
      }
    );

    if (error) {
      console.error(
        "Stok işlemi hatası:",
        error
      );

      alert(
        error.message ||
          "Stok işlemi sırasında hata oluştu."
      );

      setSaving(false);
      return;
    }

    setSaving(false);
    setShowModal(false);

    await loadData(true);

    alert(
      "Stok işlemi başarıyla kaydedildi."
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Stok Yönetimi
              </h1>

              {refreshing && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                  Güncelleniyor...
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Ürün stoklarını ve tüm stok hareketlerini takip et.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↻ Yenile
            </button>

            <Link
              href="/siparisler"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              + Yeni Sipariş
            </Link>

            <button
              onClick={openModal}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              + Stok İşlemi
            </button>
          </div>
        </div>

        {/* ERROR */}
        {loadError && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-800">
                Veri yükleme hatası
              </p>

              <p className="mt-1 text-xs text-red-600">
                {loadError}
              </p>
            </div>

            <button
              onClick={() => loadData(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* SUMMARY */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Aktif Ürün
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {products.length}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Sistemdeki aktif ürünler
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Toplam Stok
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatNumber(totalStock)}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Tüm ürünlerin toplam adedi
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Kritik Stok
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {criticalStock}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Minimum stok seviyesinde
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Stok Yok
            </p>

            <p className="mt-2 text-3xl font-bold text-orange-600">
              {outOfStock}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Stoğu 0 olan ürünler
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Stok Hareketi
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {movements.length}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Son 100 kayıt
            </p>
          </div>

        </div>

        {/* FILTERS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Ürün Ara
              </label>

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Ürün adı, SKU, barkod veya kategori..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Ürün Filtrele
              </label>

              <select
                value={productFilter}
                onChange={(e) =>
                  setProductFilter(e.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                <option value="">
                  Tüm Ürünler
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.product_name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {(search || productFilter) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">
                {filteredProducts.length} ürün gösteriliyor
              </span>

              <button
                onClick={() => {
                  setSearch("");
                  setProductFilter("");
                }}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Filtreleri Temizle
              </button>
            </div>
          )}
        </div>

        {/* STOCK TABLE */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Stok Durumu
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Ürünlerin mevcut stok miktarları.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">
                📦
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-700">
                Ürün bulunamadı.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Arama veya filtre kriterlerini değiştirmeyi deneyin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[950px] text-left text-sm">

                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">
                      Ürün
                    </th>

                    <th className="px-5 py-3">
                      SKU
                    </th>

                    <th className="px-5 py-3">
                      Barkod
                    </th>

                    <th className="px-5 py-3">
                      Kategori
                    </th>

                    <th className="px-5 py-3">
                      Mevcut Stok
                    </th>

                    <th className="px-5 py-3">
                      Min. Stok
                    </th>

                    <th className="px-5 py-3">
                      Durum
                    </th>

                    <th className="px-5 py-3 text-right">
                      İşlem
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredProducts.map((product) => {
                    const stock =
                      Number(product.stock || 0);

                    const minStock =
                      Number(product.min_stock || 0);

                    const critical =
                      stock <= minStock;

                    const empty =
                      stock <= 0;

                    return (
                      <tr
                        key={product.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {product.product_name}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-slate-500">
                          {product.sku || "-"}
                        </td>

                        <td className="px-5 py-4 text-slate-500">
                          {product.barcode || "-"}
                        </td>

                        <td className="px-5 py-4 text-slate-500">
                          {product.category || "-"}
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-900">
                          {formatNumber(stock)}{" "}
                          {product.unit || "Adet"}
                        </td>

                        <td className="px-5 py-4 text-slate-500">
                          {formatNumber(minStock)}
                        </td>

                        <td className="px-5 py-4">
                          {empty ? (
                            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                              Stok Yok
                            </span>
                          ) : critical ? (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                              Kritik
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                              Normal
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() =>
                              openStockHistory(product)
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            📜 Stok Geçmişi
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}
        </div>

        {/* MOVEMENTS */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Stok Hareketleri
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Son stok giriş ve çıkış hareketleri.
            </p>
          </div>

          {movements.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">
                📦
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-700">
                Henüz stok hareketi bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[900px] text-left text-sm">

                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">
                      Tarih
                    </th>

                    <th className="px-5 py-3">
                      Ürün
                    </th>

                    <th className="px-5 py-3">
                      İşlem
                    </th>

                    <th className="px-5 py-3">
                      Miktar
                    </th>

                    <th className="px-5 py-3">
                      Önce
                    </th>

                    <th className="px-5 py-3">
                      Sonra
                    </th>

                    <th className="px-5 py-3">
                      Açıklama
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {movements.map((movement) => {
                    const orderNumber =
                      movement.reference_id
                        ? orderMap[
                            movement.reference_id
                          ]
                        : undefined;

                    return (
                      <tr
                        key={movement.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                          {formatDate(
                            movement.created_at
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {movement.products
                              ?.product_name ||
                              "Bilinmeyen ürün"}
                          </div>

                          {movement.products?.barcode && (
                            <div className="text-xs text-slate-400">
                              {movement.products.barcode}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-700">
                            {movementIcons[
                              movement.movement_type
                            ] || "•"}{" "}
                            {movementLabels[
                              movement.movement_type
                            ] ||
                              movement.movement_type}
                          </span>
                        </td>

                        <td
                          className={`px-5 py-4 font-bold ${getMovementClass(
                            movement.movement_type
                          )}`}
                        >
                          {getMovementQuantity(
                            movement.movement_type,
                            Number(
                              movement.quantity
                            )
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-500">
                          {movement.stock_before === null
                            ? "-"
                            : formatNumber(
                                Number(
                                  movement.stock_before
                                )
                              )}
                        </td>

                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {movement.stock_after === null
                            ? "-"
                            : formatNumber(
                                Number(
                                  movement.stock_after
                                )
                              )}
                        </td>

                        <td className="px-5 py-4 text-slate-500">
                          {orderNumber ? (
                            <Link
                              href={`/siparis-gecmisi/${movement.reference_id}`}
                              className="font-semibold text-blue-600 hover:underline"
                            >
                              Sipariş #{orderNumber}
                            </Link>
                          ) : (
                            movement.note || "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>

      {/* STOCK MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Stok İşlemi
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Stok miktarını güvenli şekilde güncelle.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Kapat"
              >
                ✕
              </button>

            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">

              {/* TYPE */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  İşlem Türü
                </label>

                <select
                  value={movementType}
                  onChange={(e) =>
                    setMovementType(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="purchase">
                    📥 Stok Girişi
                  </option>

                  <option value="adjustment_out">
                    📤 Stok Çıkışı
                  </option>

                  <option value="damage">
                    🗑️ Hasarlı Ürün
                  </option>

                  <option value="count">
                    📊 Stok Sayımı
                  </option>
                </select>

                {movementType === "count" && (
                  <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      📊 Stok Sayımı
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      Depoda fiziksel olarak saydığın gerçek
                      stok miktarını gir. Sistem mevcut stoğu
                      bu miktara eşitleyecektir.
                    </p>

                    <p className="mt-2 text-xs font-semibold text-blue-800">
                      Örnek: Sistem 100 gösteriyor,
                      depoda 87 adet varsa buraya{" "}
                      <strong>87</strong> yaz.
                    </p>

                    <p className="mt-2 text-xs font-semibold text-blue-800">
                      Depoda hiç ürün yoksa <strong>0</strong>{" "}
                      girebilirsin.
                    </p>
                  </div>
                )}
              </div>

              {/* PRODUCT */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Ürün
                </label>

                <select
                  value={selectedProductId}
                  onChange={(e) =>
                    setSelectedProductId(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">
                    Ürün seçin...
                  </option>

                  {products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.product_name}
                      {product.sku
                        ? ` - ${product.sku}`
                        : ""}
                      {product.barcode
                        ? ` - ${product.barcode}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* CURRENT STOCK */}
              {selectedProduct && (
                <div className="rounded-xl bg-slate-50 p-4">

                  <div className="flex items-center justify-between gap-4">

                    <div>
                      <p className="text-xs text-slate-400">
                        Mevcut Stok
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {formatNumber(
                          Number(
                            selectedProduct.stock || 0
                          )
                        )}{" "}
                        {selectedProduct.unit ||
                          "Adet"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        Min. Stok
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {formatNumber(
                          Number(
                            selectedProduct.min_stock ||
                              0
                          )
                        )}
                      </p>
                    </div>

                  </div>

                </div>
              )}

              {/* QUANTITY */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {movementType === "count"
                    ? "Depodaki Gerçek Stok"
                    : "Miktar"}
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value
                    )
                  }
                  placeholder={
                    movementType === "count"
                      ? "Örn: 87 veya 0"
                      : "Miktar"
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

                {movementType === "count" && (
                  <p className="mt-2 text-xs text-slate-400">
                    Sayımda 0 geçerli bir değerdir.
                  </p>
                )}
              </div>

              {/* PREVIEW */}
              {selectedProduct &&
                quantity.trim() !== "" &&
                Number.isFinite(enteredQuantity) &&
                enteredQuantity >= 0 && (
                  <div
                    className={`rounded-xl border p-4 ${
                      previewStock !== null &&
                      previewStock < 0
                        ? "border-red-200 bg-red-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">

                      <div>
                        <p className="text-xs text-slate-400">
                          İşlem Sonrası Stok
                        </p>

                        <p
                          className={`mt-1 text-2xl font-bold ${
                            previewStock !== null &&
                            previewStock < 0
                              ? "text-red-600"
                              : "text-slate-900"
                          }`}
                        >
                          {previewStock === null
                            ? "-"
                            : formatNumber(
                                previewStock
                              )}{" "}
                          {selectedProduct.unit ||
                            "Adet"}
                        </p>
                      </div>

                      <div className="text-2xl text-slate-300">
                        →
                      </div>

                    </div>

                    {previewStock !== null &&
                      previewStock < 0 && (
                        <p className="mt-3 text-xs font-semibold text-red-600">
                          Bu işlem stok miktarını negatife düşürüyor.
                        </p>
                      )}
                  </div>
                )}

              {/* NOTE */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Açıklama
                </label>

                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  rows={3}
                  maxLength={500}
                  placeholder={
                    movementType === "count"
                      ? "Örn: Depo sayımı"
                      : "Örn: İstoç alış, hasarlı ürün..."
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {note.length}/500
                </p>
              </div>

            </div>

            {/* FOOTER */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row">

              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Vazgeç
              </button>

              <button
                onClick={saveMovement}
                disabled={
                  saving ||
                  !selectedProductId ||
                  !isQuantityValid
                }
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Kaydediliyor..."
                  : "İşlemi Kaydet"}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* STOCK HISTORY MODAL */}
      {historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">

              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900">
                  📜 Stok Geçmişi
                </h2>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">

                  <span className="font-semibold text-slate-700">
                    {historyProduct.product_name}
                  </span>

                  {historyProduct.sku && (
                    <>
                      <span>•</span>
                      <span>
                        SKU: {historyProduct.sku}
                      </span>
                    </>
                  )}

                  {historyProduct.barcode && (
                    <>
                      <span>•</span>
                      <span>
                        {historyProduct.barcode}
                      </span>
                    </>
                  )}

                </div>
              </div>

              <button
                onClick={closeStockHistory}
                disabled={historyLoading}
                className="ml-4 shrink-0 rounded-lg px-3 py-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Kapat"
              >
                ✕
              </button>

            </div>

            {/* PRODUCT SUMMARY */}
            <div className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 sm:gap-4 sm:p-5">

              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-slate-400">
                  Mevcut Stok
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatNumber(
                    Number(
                      historyProduct.stock || 0
                    )
                  )}{" "}
                  {historyProduct.unit ||
                    "Adet"}
                </p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-slate-400">
                  Toplam Hareket
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {historyMovements.length}
                </p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-slate-400">
                  Minimum Stok
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatNumber(
                    Number(
                      historyProduct.min_stock ||
                        0
                    )
                  )}{" "}
                  {historyProduct.unit ||
                    "Adet"}
                </p>
              </div>

            </div>

            {/* CONTENT */}
            <div className="min-h-0 flex-1 overflow-auto">

              {historyLoading ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  Stok geçmişi yükleniyor...
                </div>
              ) : historyMovements.length === 0 ? (
                <div className="p-10 text-center">

                  <div className="text-4xl">
                    📦
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    Bu ürüne ait stok hareketi yok.
                  </p>

                </div>
              ) : (
                <table className="w-full min-w-[900px] text-left text-sm">

                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">
                        Tarih
                      </th>

                      <th className="px-5 py-3">
                        İşlem
                      </th>

                      <th className="px-5 py-3">
                        Değişim
                      </th>

                      <th className="px-5 py-3">
                        Önce
                      </th>

                      <th className="px-5 py-3">
                        Sonra
                      </th>

                      <th className="px-5 py-3">
                        Açıklama
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {historyMovements.map(
                      (movement) => {
                        const orderNumber =
                          movement.reference_id
                            ? orderMap[
                                movement.reference_id
                              ]
                            : undefined;

                        return (
                          <tr
                            key={movement.id}
                            className="hover:bg-slate-50"
                          >
                            <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                              {formatDate(
                                movement.created_at
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span className="font-semibold text-slate-700">
                                {movementIcons[
                                  movement
                                    .movement_type
                                ] || "•"}{" "}
                                {movementLabels[
                                  movement
                                    .movement_type
                                ] ||
                                  movement
                                    .movement_type}
                              </span>
                            </td>

                            <td
                              className={`px-5 py-4 font-bold ${getMovementClass(
                                movement.movement_type
                              )}`}
                            >
                              {getHistoryQuantity(
                                movement
                              )}
                            </td>

                            <td className="px-5 py-4 text-slate-500">
                              {movement.stock_before ===
                              null
                                ? "-"
                                : formatNumber(
                                    Number(
                                      movement.stock_before
                                    )
                                  )}
                            </td>

                            <td className="px-5 py-4 font-bold text-slate-900">
                              {movement.stock_after ===
                              null
                                ? "-"
                                : formatNumber(
                                    Number(
                                      movement.stock_after
                                    )
                                  )}
                            </td>

                            <td className="px-5 py-4 text-slate-500">
                              {orderNumber ? (
                                <Link
                                  href={`/siparis-gecmisi/${movement.reference_id}`}
                                  className="font-semibold text-blue-600 hover:underline"
                                >
                                  Sipariş #{orderNumber}
                                </Link>
                              ) : (
                                movement.note ||
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>
              )}

            </div>

            {/* FOOTER */}
            <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-4 sm:px-6">

              <button
                onClick={closeStockHistory}
                disabled={historyLoading}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Kapat
              </button>

            </div>

          </div>

        </div>
      )}
    </main>
  );
}
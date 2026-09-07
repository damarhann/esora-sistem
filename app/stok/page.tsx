"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  product_name: string;
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
  purchase: "Alış",
  sale: "Satış",
  return: "İade",
  adjustment_in: "Stok Girişi",
  adjustment_out: "Stok Çıkışı",
  damage: "Hasarlı",
  count: "Sayım",
};

const movementIcons: Record<string, string> = {
  purchase: "📥",
  sale: "📤",
  return: "↩️",
  adjustment_in: "➕",
  adjustment_out: "➖",
  damage: "🗑️",
  count: "📊",
};

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<OrderInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [movementType, setMovementType] =
    useState("purchase");

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [quantity, setQuantity] = useState("");

  const [note, setNote] = useState("");

  // STOK GEÇMİŞİ
  const [historyProduct, setHistoryProduct] =
    useState<Product | null>(null);

  const [historyMovements, setHistoryMovements] =
    useState<StockMovement[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  async function loadData() {
    setLoading(true);

    const [
      productsResult,
      movementsResult,
      ordersResult,
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, product_name, barcode, category, stock, min_stock, unit"
        )
        .eq("is_active", true)
        .order("product_name"),

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

    if (productsResult.error) {
      console.error(productsResult.error);
    }

    if (movementsResult.error) {
      console.error(movementsResult.error);
    }

    if (ordersResult.error) {
      console.error(ordersResult.error);
    }

    setProducts(
      (productsResult.data || []) as Product[]
    );

    setMovements(
  (movementsResult.data ?? []) as unknown as StockMovement[]
);

    setOrders(
      (ordersResult.data || []) as OrderInfo[]
    );

    setLoading(false);
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
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.product_name
          .toLowerCase()
          .includes(query) ||
        (product.barcode || "")
          .toLowerCase()
          .includes(query) ||
        (product.category || "")
          .toLowerCase()
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

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId
  );

  const enteredQuantity = Number(quantity || 0);

  const previewStock = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    const current = Number(
      selectedProduct.stock || 0
    );

    // STOK SAYIMI:
    // Girilen miktar doğrudan yeni stok miktarıdır.
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

  async function openStockHistory(
    product: Product
  ) {
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
      console.error(error);
      alert(
        error.message ||
          "Stok geçmişi yüklenirken hata oluştu."
      );

      setHistoryLoading(false);
      return;
    }

    setHistoryMovements(
  (data ?? []) as unknown as StockMovement[]
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

    if (!quantity || enteredQuantity <= 0) {
      alert("Miktar 0'dan büyük olmalıdır.");
      return;
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
          selectedProduct.stock
        )}`
      );
      return;
    }

    if (
      movementType === "count" &&
      enteredQuantity < 0
    ) {
      alert(
        "Sayım miktarı negatif olamaz."
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
      console.error(error);

      alert(
        error.message ||
          "Stok işlemi sırasında hata oluştu."
      );

      setSaving(false);
      return;
    }

    setSaving(false);
    setShowModal(false);

    await loadData();

    alert(
      "Stok işlemi başarıyla kaydedildi."
    );
  }

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
      type === "adjustment_in"
    ) {
      return "text-green-600";
    }

    if (
      type === "sale" ||
      type === "adjustment_out" ||
      type === "damage"
    ) {
      return "text-red-600";
    }

    return "text-blue-600";
  }

  function getMovementQuantity(
    type: string,
    quantity: number
  ) {
    if (
      type === "sale" ||
      type === "adjustment_out" ||
      type === "damage"
    ) {
      return `-${formatNumber(
        Math.abs(quantity)
      )}`;
    }

    if (type === "count") {
      return formatNumber(quantity);
    }

    return `+${formatNumber(
      Math.abs(quantity)
    )}`;
  }

  function getHistoryQuantity(
    movement: StockMovement
  ) {
    const quantity = Number(
      movement.quantity || 0
    );

    if (movement.movement_type === "count") {
      if (
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
          return `-${formatNumber(
            Math.abs(difference)
          )}`;
        }

        return "0";
      }

      return formatNumber(quantity);
    }

    return getMovementQuantity(
      movement.movement_type,
      quantity
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Stok Yönetimi
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Ürün stoklarını ve tüm stok hareketlerini takip et.
            </p>
          </div>

          <div className="flex gap-3">

            <Link
              href="/siparisler"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              + Yeni Sipariş
            </Link>

            <button
              onClick={openModal}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              + Stok İşlemi
            </button>

          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Ürün Ara
              </label>

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Ürün adı, barkod veya kategori..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
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
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
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
            <div className="p-8 text-center text-sm text-slate-500">
              Yükleniyor...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Ürün bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

                <thead className="bg-slate-50 text-xs uppercase text-slate-500">

                  <tr>
                    <th className="px-5 py-3">
                      Ürün
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

                  {filteredProducts.map(
                    (product) => {

                      const stock =
                        Number(product.stock || 0);

                      const minStock =
                        Number(
                          product.min_stock || 0
                        );

                      const critical =
                        stock <= minStock;

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-slate-50"
                        >

                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {product.product_name}
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

                            {critical ? (
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
                                openStockHistory(
                                  product
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              📜 Stok Geçmişi
                            </button>

                          </td>

                        </tr>
                      );
                    }
                  )}

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
            <div className="p-8 text-center text-sm text-slate-500">
              Henüz stok hareketi bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

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

                  {movements.map(
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

                            <div className="font-semibold text-slate-900">
                              {movement.products
                                ?.product_name ||
                                "Bilinmeyen ürün"}
                            </div>

                            {movement.products
                              ?.barcode && (
                              <div className="text-xs text-slate-400">
                                {
                                  movement.products
                                    .barcode
                                }
                              </div>
                            )}

                          </td>

                          <td className="px-5 py-4">

                            <span className="font-semibold text-slate-700">

                              {
                                movementIcons[
                                  movement
                                    .movement_type
                                ] || "•"
                              }{" "}

                              {
                                movementLabels[
                                  movement
                                    .movement_type
                                ] ||
                                  movement
                                    .movement_type
                              }

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

                            {movement.stock_before ===
                            null
                              ? "-"
                              : formatNumber(
                                  Number(
                                    movement.stock_before
                                  )
                                )}

                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-900">

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
                              movement.note || "-"
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>

      {/* STOCK MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

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
                className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>

            </div>

            <div className="space-y-5 p-6">

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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                >

                  <option value="purchase">
                    📥 Stok Girişi / Alış
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
                      Depoda fiziksel olarak
                      saydığın gerçek stok miktarını
                      gir. Sistem mevcut stoğu bu
                      miktara eşitleyecektir.
                    </p>

                    <p className="mt-2 text-xs font-semibold text-blue-800">
                      Örnek: Sistem 100 gösteriyor,
                      depoda 87 adet varsa buraya
                      <strong> 87</strong> yaz.
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                >

                  <option value="">
                    Ürün seçin...
                  </option>

                  {products.map(
                    (product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.product_name}
                        {product.barcode
                          ? ` - ${product.barcode}`
                          : ""}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* CURRENT STOCK */}
              {selectedProduct && (
                <div className="rounded-xl bg-slate-50 p-4">

                  <div className="flex items-center justify-between">

                    <span className="text-sm text-slate-500">
                      Mevcut Stok
                    </span>

                    <span className="text-lg font-bold text-slate-900">
                      {formatNumber(
                        Number(
                          selectedProduct.stock ||
                            0
                        )
                      )}{" "}
                      {selectedProduct.unit ||
                        "Adet"}
                    </span>

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
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value
                    )
                  }
                  placeholder={
                    movementType === "count"
                      ? "Örn: 87"
                      : "Miktar"
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />

              </div>

              {/* PREVIEW */}
              {selectedProduct &&
                quantity &&
                enteredQuantity >= 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">

                    <div className="flex items-center justify-between">

                      <div>

                        <p className="text-xs text-slate-400">
                          İşlem Sonrası Stok
                        </p>

                        <p
                          className={`mt-1 text-2xl font-bold ${
                            previewStock !==
                              null &&
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

                      <div className="text-3xl">
                        →
                      </div>

                    </div>

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
                  placeholder={
                    movementType === "count"
                      ? "Örn: Depo sayımı"
                      : "Örn: İstoç alış, hasarlı ürün..."
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />

              </div>

            </div>

            {/* FOOTER */}
            <div className="flex gap-3 border-t border-slate-200 px-6 py-5">

              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Vazgeç
              </button>

              <button
                onClick={saveMovement}
                disabled={saving}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  📜 Stok Geçmişi
                </h2>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">

                  <span className="font-semibold text-slate-700">
                    {historyProduct.product_name}
                  </span>

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
                className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ✕
              </button>

            </div>

            {/* PRODUCT SUMMARY */}
            <div className="grid grid-cols-1 gap-4 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-3">

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
                                movement
                                  .reference_id
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

                                {
                                  movementIcons[
                                    movement
                                      .movement_type
                                  ] || "•"
                                }{" "}

                                {
                                  movementLabels[
                                    movement
                                      .movement_type
                                  ] ||
                                    movement
                                      .movement_type
                                }

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
            <div className="flex justify-end border-t border-slate-200 bg-white px-6 py-4">

              <button
                onClick={closeStockHistory}
                disabled={historyLoading}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
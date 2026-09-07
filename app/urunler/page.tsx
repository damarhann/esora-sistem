"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  is_active: boolean;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    productName: "",
    barcode: "",
    category: "",
    purchasePrice: "",
    retailPrice: "",
  });

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, product_name, barcode, category, purchase_price, retail_price, stock, unit, is_active"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Ürünler yüklenirken hata oluştu.");
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({
      productName: "",
      barcode: "",
      category: "",
      purchasePrice: "",
      retailPrice: "",
    });

    setEditingId(null);
  }

  function openNewProduct() {
    resetForm();
    setShowForm(true);
  }

  function openEditProduct(product: Product) {
    setEditingId(product.id);

    setForm({
      productName: product.product_name || "",
      barcode: product.barcode || "",
      category: product.category || "",
      purchasePrice: String(product.purchase_price ?? ""),
      retailPrice: String(product.retail_price ?? ""),
    });

    setShowForm(true);
  }

 async function saveProduct() {
  if (!form.productName.trim()) {
    alert("Ürün adı zorunludur.");
    return;
  }

  const purchasePrice = Number(form.purchasePrice);
  const retailPrice = Number(form.retailPrice);

  if (form.purchasePrice && purchasePrice < 0) {
    alert("Alış fiyatı negatif olamaz.");
    return;
  }

  if (form.retailPrice && retailPrice < 0) {
    alert("Satış fiyatı negatif olamaz.");
    return;
  }

  setSaving(true);

  let error = null;

  if (editingId) {
    const result = await supabase.rpc("update_product", {
      p_product_id: editingId,
      p_product_name: form.productName.trim(),
      p_barcode: form.barcode.trim() || null,
      p_category: form.category.trim() || null,
      p_purchase_price: purchasePrice || 0,
      p_retail_price: retailPrice || 0,
    });

    error = result.error;
  } else {
    const result = await supabase.rpc("create_product", {
      p_product_name: form.productName.trim(),
      p_barcode: form.barcode.trim() || null,
      p_category: form.category.trim() || null,
      p_purchase_price: purchasePrice || 0,
      p_retail_price: retailPrice || 0,
    });

    error = result.error;
  }

  if (error) {
    console.error(error);

    alert(error.message || "Ürün kaydedilemedi.");

    setSaving(false);
    return;
  }

  const wasCreating = !editingId;

  setSaving(false);
  setShowForm(false);
  resetForm();

  await loadProducts();

  if (wasCreating) {
    alert(
      "Ürün başarıyla oluşturuldu.\n\nİlk stok miktarını Stok Yönetimi sayfasından girebilirsin."
    );
  }
}

  async function deactivateProduct(product: Product) {
  const confirmed = window.confirm(
    `"${product.product_name}" ürününü pasife almak istediğine emin misin?\n\nÜrün silinmeyecek. Sipariş ve stok geçmişi korunacaktır.`
  );

  if (!confirmed) return;

  const { error } = await supabase.rpc(
    "deactivate_product",
    {
      p_product_id: product.id,
    }
  );

  if (error) {
    console.error(error);
    alert(
      error.message || "Ürün pasife alınamadı."
    );
    return;
  }

  await loadProducts();
}

  function formatPrice(value: number | null) {
    return Number(value || 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatStock(value: number | null) {
    return Number(value || 0).toLocaleString("tr-TR", {
      maximumFractionDigits: 2,
    });
  }

  const filteredProducts = products.filter((product) => {
    const text = search.toLocaleLowerCase("tr-TR");

    return (
      product.product_name
        ?.toLocaleLowerCase("tr-TR")
        .includes(text) ||
      product.barcode?.includes(search) ||
      product.category
        ?.toLocaleLowerCase("tr-TR")
        .includes(text)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Ürünler
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              ESORA ürün kartlarını ve temel ürün bilgilerini yönet.
            </p>
          </div>

          <div className="flex gap-3">

            <Link
              href="/stok"
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              📦 Stok Yönetimi
            </Link>

            <button
              onClick={openNewProduct}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              + Yeni Ürün
            </button>

          </div>

        </div>

        {/* INFO */}
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">

          <p className="text-sm font-semibold text-blue-900">
            📦 Stok yönetimi ayrı tutulur
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-700">
            Ürün kartından stok değiştirilmez. Stok giriş,
            çıkış, hasarlı ürün ve sayım işlemlerini
            <strong> Stok Yönetimi</strong> bölümünden yap.
            Böylece tüm stok hareketleri geçmişe kaydedilir.
          </p>

        </div>

        {/* ARAMA */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün adı, barkod veya kategori ara..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
          />

        </div>

        {/* ÜRÜN LİSTESİ */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-4">

            <div className="flex items-center justify-between">

              <h2 className="font-bold text-slate-900">
                Ürün Listesi

                <span className="ml-2 text-sm font-normal text-slate-400">
                  ({filteredProducts.length})
                </span>
              </h2>

              <Link
                href="/stok"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Stokları Yönet →
              </Link>

            </div>

          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-500">
              Ürünler yükleniyor...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              Ürün bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-slate-50">

                  <tr>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                      Ürün
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                      Barkod
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                      Kategori
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Alış
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Satış
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Stok
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      İşlem
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredProducts.map((product) => (

                    <tr
                      key={product.id}
                      className="hover:bg-slate-50"
                    >

                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {product.product_name}
                      </td>

                      <td className="px-6 py-4 font-mono text-sm text-slate-600">
                        {product.barcode || "-"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {product.category || "-"}
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatPrice(product.purchase_price)} ₺
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatPrice(product.retail_price)} ₺
                      </td>

                      <td className="px-6 py-4 text-right">

                        <Link
                          href="/stok"
                          className="inline-flex rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                        >
                          {formatStock(product.stock)}{" "}
                          {product.unit || "Adet"}
                        </Link>

                      </td>

                      <td className="px-6 py-4">

                        <div className="flex justify-end gap-2">

                          <button
                            onClick={() =>
                              openEditProduct(product)
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Düzenle
                          </button>

                          <button
                            onClick={() =>
                              deactivateProduct(product)
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Pasife Al
                          </button>

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>
          )}

        </div>

        {/* FORM MODAL */}
        {showForm && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

            <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">

              {/* HEADER */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

                <div>

                  <h2 className="text-xl font-bold text-slate-900">
                    {editingId
                      ? "Ürünü Düzenle"
                      : "Yeni Ürün"}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Stok miktarı bu ekrandan değiştirilmez.
                  </p>

                </div>

                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-2xl text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>

              </div>

              <div className="space-y-4 p-6">

                {/* ÜRÜN ADI */}
                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ürün Adı *
                  </label>

                  <input
                    name="productName"
                    value={form.productName}
                    onChange={handleChange}
                    placeholder="Örn: ESORA Krom Mix Eviye Bataryası"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />

                </div>

                {/* BARKOD */}
                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Barkod
                  </label>

                  <input
                    name="barcode"
                    value={form.barcode}
                    onChange={handleChange}
                    inputMode="numeric"
                    placeholder="Örn: 8691234567890"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 font-mono outline-none focus:border-slate-400"
                  />

                </div>

                {/* KATEGORİ */}
                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Kategori
                  </label>

                  <input
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="Örn: Bataryalar"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />

                </div>

                {/* FİYATLAR */}
                <div className="grid grid-cols-2 gap-4">

                  <div>

                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Alış Fiyatı
                    </label>

                    <input
                      name="purchasePrice"
                      value={form.purchasePrice}
                      onChange={handleChange}
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                    />

                  </div>

                  <div>

                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Satış Fiyatı
                    </label>

                    <input
                      name="retailPrice"
                      value={form.retailPrice}
                      onChange={handleChange}
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                    />

                  </div>

                </div>

                {/* STOK BİLGİSİ */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                  <p className="text-sm font-semibold text-slate-800">
                    📦 Stok Yönetimi
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Ürün oluşturulduktan sonra stok girişini
                    Stok Yönetimi sayfasından yapabilirsin.
                    Böylece stok hareketi kayıt altına alınır.
                  </p>

                  {editingId && (
                    <Link
                      href="/stok"
                      className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Stok Yönetimine Git →
                    </Link>
                  )}

                </div>

              </div>

              {/* FOOTER */}
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">

                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Vazgeç
                </button>

                <button
                  onClick={saveProduct}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving
                    ? "Kaydediliyor..."
                    : editingId
                    ? "Değişiklikleri Kaydet"
                    : "Ürünü Kaydet"}
                </button>

              </div>

            </div>

          </div>

        )}

      </div>
    </div>
  );
}
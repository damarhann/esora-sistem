"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  purchase_price: number | null;
  wholesale_price: number | null;
  retail_price: number | null;
  image_url: string | null;
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

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    productName: "",
    sku: "",
    barcode: "",
    category: "",
    purchasePrice: "",
    wholesalePrice: "",
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
        "id, product_name, sku, barcode, category, purchase_price, wholesale_price, retail_price, image_url, stock, unit, is_active"
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
      sku: "",
      barcode: "",
      category: "",
      purchasePrice: "",
      wholesalePrice: "",
      retailPrice: "",
    });

    setSelectedImage(null);
    setImagePreview(null);
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
      sku: product.sku || "",
      barcode: product.barcode || "",
      category: product.category || "",
      purchasePrice: String(product.purchase_price ?? ""),
      wholesalePrice: String(product.wholesale_price ?? ""),
      retailPrice: String(product.retail_price ?? ""),
    });

    setSelectedImage(null);
    setImagePreview(product.image_url || null);

    setShowForm(true);
  }

  function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Lütfen geçerli bir görsel dosyası seç.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Görsel boyutu en fazla 10 MB olabilir.");
      return;
    }

    setSelectedImage(file);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  }

  function removeSelectedImage() {
    setSelectedImage(null);
    setImagePreview(null);
  }

  async function uploadProductImage(
    productId: string,
    file: File
  ) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${productId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error("Görsel URL'si oluşturulamadı.");
    }

    const { error: imageUpdateError } = await supabase.rpc(
      "update_product_image",
      {
        p_product_id: productId,
        p_image_url: data.publicUrl,
      }
    );

    if (imageUpdateError) {
      // Veritabanına bağlanamazsa yüklenen dosyayı temizlemeyi dene.
      await supabase.storage
        .from("product-images")
        .remove([filePath]);

      throw imageUpdateError;
    }

    return data.publicUrl;
  }

  async function saveProduct() {
    if (!form.productName.trim()) {
      alert("Ürün adı zorunludur.");
      return;
    }

    const purchasePrice = Number(form.purchasePrice || 0);
    const wholesalePrice = Number(form.wholesalePrice || 0);
    const retailPrice = Number(form.retailPrice || 0);

    if (purchasePrice < 0) {
      alert("Alış fiyatı negatif olamaz.");
      return;
    }

    if (wholesalePrice < 0) {
      alert("Toptan satış fiyatı negatif olamaz.");
      return;
    }

    if (retailPrice < 0) {
      alert("Satış fiyatı negatif olamaz.");
      return;
    }

    setSaving(true);

    let productId = editingId;
    let error = null;

    if (editingId) {
      const result = await supabase.rpc("update_product", {
        p_product_id: editingId,
        p_product_name: form.productName.trim(),
        p_sku: form.sku.trim() || null,
        p_barcode: form.barcode.trim() || null,
        p_category: form.category.trim() || null,
        p_purchase_price: purchasePrice,
        p_wholesale_price: wholesalePrice,
        p_retail_price: retailPrice,
      });

      error = result.error;
    } else {
      const result = await supabase.rpc("create_product", {
        p_product_name: form.productName.trim(),
        p_sku: form.sku.trim() || null,
        p_barcode: form.barcode.trim() || null,
        p_category: form.category.trim() || null,
        p_purchase_price: purchasePrice,
        p_wholesale_price: wholesalePrice,
        p_retail_price: retailPrice,
      });

      error = result.error;
      productId = result.data;
    }

    if (error) {
      console.error(error);

      alert(error.message || "Ürün kaydedilemedi.");

      setSaving(false);
      return;
    }

    // Görsel seçilmişse yükle
    if (selectedImage && productId) {
      try {
        await uploadProductImage(productId, selectedImage);
      } catch (imageError: any) {
        console.error(imageError);

        alert(
          `Ürün bilgileri kaydedildi ancak görsel yüklenemedi.\n\n${
            imageError?.message || "Görsel yükleme hatası."
          }`
        );
      }
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
    } else {
      alert("Ürün başarıyla güncellendi.");
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
      product.sku
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
            placeholder="Ürün adı, SKU, barkod veya kategori ara..."
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
                      SKU
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
                      Toptan
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

                      {/* ÜRÜN + GÖRSEL */}
                      <td className="px-6 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">

                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.product_name}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-xl text-slate-300">
                                📷
                              </span>
                            )}

                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">
                              {product.product_name}
                            </p>

                            {product.unit && (
                              <p className="mt-1 text-xs text-slate-400">
                                Birim: {product.unit}
                              </p>
                            )}
                          </div>

                        </div>

                      </td>

                      {/* SKU */}
                      <td className="px-6 py-4 font-mono text-sm text-slate-600">
                        {product.sku || "-"}
                      </td>

                      {/* BARKOD */}
                      <td className="px-6 py-4 font-mono text-sm text-slate-600">
                        {product.barcode || "-"}
                      </td>

                      {/* KATEGORİ */}
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {product.category || "-"}
                      </td>

                      {/* ALIŞ */}
                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatPrice(product.purchase_price)} ₺
                      </td>

                      {/* TOPTAN */}
                      <td className="px-6 py-4 text-right text-sm font-semibold text-blue-700">
                        {formatPrice(product.wholesale_price)} ₺
                      </td>

                      {/* SATIŞ */}
                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatPrice(product.retail_price)} ₺
                      </td>

                      {/* STOK */}
                      <td className="px-6 py-4 text-right">

                        <Link
                          href="/stok"
                          className="inline-flex rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                        >
                          {formatStock(product.stock)}{" "}
                          {product.unit || "Adet"}
                        </Link>

                      </td>

                      {/* İŞLEM */}
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

            <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

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

              <div className="space-y-5 p-6">

                {/* ÜRÜN GÖRSELİ */}
                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Ürün Görseli
                  </label>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

                    <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">

                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Ürün önizleme"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="text-center">
                          <div className="text-3xl">
                            📷
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            Görsel yok
                          </p>
                        </div>
                      )}

                    </div>

                    <div className="flex-1">

                      <label className="inline-flex cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">

                        📷 Görsel Seç

                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />

                      </label>

                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        JPG, PNG, WEBP gibi görseller kullanılabilir.
                        Maksimum 10 MB.
                      </p>

                      {selectedImage && (
                        <p className="mt-2 text-xs font-medium text-green-600">
                          ✓ Yeni görsel seçildi
                        </p>
                      )}

                      {imagePreview && (
                        <button
                          type="button"
                          onClick={removeSelectedImage}
                          className="mt-2 text-xs font-medium text-red-500 hover:underline"
                        >
                          Görseli kaldır
                        </button>
                      )}

                    </div>

                  </div>

                </div>

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

                {/* SKU + BARKOD */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                  <div>

                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      SKU / Ürün Kodu
                    </label>

                    <input
                      name="sku"
                      value={form.sku}
                      onChange={handleChange}
                      placeholder="Örn: ES-BAT-001"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 font-mono outline-none focus:border-slate-400"
                    />

                    <p className="mt-1 text-xs text-slate-400">
                      Her üründe benzersiz olmalıdır.
                    </p>

                  </div>

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
                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Fiyat Bilgileri
                  </label>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                    {/* ALIŞ */}
                    <div>

                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Alış Fiyatı
                      </label>

                      <div className="relative">

                        <input
                          name="purchasePrice"
                          value={form.purchasePrice}
                          onChange={handleChange}
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-10 outline-none focus:border-slate-400"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          ₺
                        </span>

                      </div>

                    </div>

                    {/* TOPTAN */}
                    <div>

                      <label className="mb-1 block text-xs font-medium text-blue-600">
                        Toptan Satış
                      </label>

                      <div className="relative">

                        <input
                          name="wholesalePrice"
                          value={form.wholesalePrice}
                          onChange={handleChange}
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full rounded-xl border border-blue-200 bg-blue-50/30 px-4 py-3 pr-10 outline-none focus:border-blue-400"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-blue-400">
                          ₺
                        </span>

                      </div>

                    </div>

                    {/* PERAKENDE */}
                    <div>

                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Perakende Satış
                      </label>

                      <div className="relative">

                        <input
                          name="retailPrice"
                          value={form.retailPrice}
                          onChange={handleChange}
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-10 outline-none focus:border-slate-400"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          ₺
                        </span>

                      </div>

                    </div>

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
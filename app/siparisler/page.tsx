"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
};

type Product = {
  id: string;
  product_name: string;
  barcode: string | null;
  retail_price: number | null;
  stock: number | null;
  unit: string | null;
};

type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
};

export default function OrdersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedCustomer, setSelectedCustomer] =
    useState("");

  const [selectedProduct, setSelectedProduct] =
    useState("");

  const [quantity, setQuantity] = useState("1");

  const [barcode, setBarcode] = useState("");

  const [salePrice, setSalePrice] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [creatingOrder, setCreatingOrder] =
    useState(false);

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [scannerLoading, setScannerLoading] =
    useState(false);

  const barcodeInputRef =
    useRef<HTMLInputElement | null>(null);

  const quantityInputRef =
    useRef<HTMLInputElement | null>(null);

  const priceInputRef =
    useRef<HTMLInputElement | null>(null);

  const scannerRef =
    useRef<Html5Qrcode | null>(null);

  const scannerStartedRef =
    useRef(false);

  useEffect(() => {
    loadData();

    return () => {
      stopScanner();
    };
  }, []);

  async function loadData() {
    setLoading(true);

    const [customersResult, productsResult] =
      await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, company_name, contact_name"
          )
          .order("company_name"),

        supabase
          .from("products")
          .select(
            "id, product_name, barcode, retail_price, stock, unit"
          )
          .eq("is_active", true)
          .order("product_name"),
      ]);

    if (customersResult.error) {
      console.error(customersResult.error);
      alert("Müşteriler yüklenemedi.");
    }

    if (productsResult.error) {
      console.error(productsResult.error);
      alert("Ürünler yüklenemedi.");
    }

    setCustomers(customersResult.data || []);
    setProducts(productsResult.data || []);

    setLoading(false);
  }

  function focusBarcode() {
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  }

  function focusQuantity() {
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 50);
  }

  function focusPrice() {
    setTimeout(() => {
      priceInputRef.current?.focus();
      priceInputRef.current?.select();
    }, 50);
  }

  function findProductByBarcode(
    code: string
  ) {
    const cleanBarcode = code.trim();

    if (!cleanBarcode) {
      alert("Barkod gir.");
      return null;
    }

    const product = products.find(
      (item) =>
        item.barcode?.trim() === cleanBarcode
    );

    if (!product) {
      alert(
        `Bu barkoda ait ürün bulunamadı.\n\nBarkod: ${cleanBarcode}`
      );

      return null;
    }

    return product;
  }

  function prepareProduct(product: Product) {
    setSelectedProduct(product.id);

    const existing = cart.find(
      (item) =>
        item.product.id === product.id
    );

    /*
      Ürün daha önce sepette varsa,
      mevcut satış fiyatını koruyoruz.
    */

    if (existing) {
      setQuantity(
        String(existing.quantity)
      );

      setSalePrice(
        String(existing.unitPrice)
      );
    } else {
      setQuantity("1");

      setSalePrice(
        String(
          Number(product.retail_price || 0)
        )
      );
    }

    focusPrice();
  }

  function handleBarcodeSearch() {
    if (!selectedCustomer) {
      alert("Önce müşteri seç.");
      return;
    }

    const product =
      findProductByBarcode(barcode);

    if (!product) {
      return;
    }

    prepareProduct(product);
  }

  async function startScanner() {
    if (!selectedCustomer) {
      alert("Önce müşteri seç.");
      return;
    }

    if (scannerStartedRef.current) {
      return;
    }

    setScannerLoading(true);
    setScannerOpen(true);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 150)
      );

      const scanner = new Html5Qrcode(
        "barcode-reader"
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
            height: 120,
          },
          aspectRatio: 1.777778,
        },
        async (decodedText) => {
          const cleanBarcode =
            decodedText.trim();

          const product =
            products.find(
              (item) =>
                item.barcode?.trim() ===
                cleanBarcode
            );

          if (!product) {
            await stopScanner();

            alert(
              `Bu barkoda ait ürün bulunamadı.\n\nBarkod: ${cleanBarcode}`
            );

            focusBarcode();

            return;
          }

          setBarcode(cleanBarcode);

          prepareProduct(product);

          await stopScanner();

          focusPrice();
        },
        () => {
          // Barkod bulunamadığında
          // sürekli hata göstermiyoruz.
        }
      );

      scannerStartedRef.current = true;
    } catch (error) {
      console.error(error);

      setScannerOpen(false);

      alert(
        "Kamera açılamadı.\n\nTarayıcının kamera iznine sahip olduğundan ve sayfanın HTTPS üzerinden açıldığından emin ol."
      );
    } finally {
      setScannerLoading(false);
    }
  }

  async function stopScanner() {
    try {
      if (
        scannerRef.current &&
        scannerStartedRef.current
      ) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (error) {
      console.error(error);
    }

    scannerRef.current = null;
    scannerStartedRef.current = false;

    setScannerOpen(false);
    setScannerLoading(false);
  }

  function addToCart() {
    if (!selectedCustomer) {
      alert("Önce müşteri seç.");
      return;
    }

    if (!selectedProduct) {
      alert(
        "Önce barkod okut veya ürün seç."
      );
      return;
    }

    const product = products.find(
      (item) =>
        item.id === selectedProduct
    );

    if (!product) {
      return;
    }

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      alert("Geçerli bir miktar gir.");

      focusQuantity();

      return;
    }

    const price = Number(salePrice);

    if (
      salePrice.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      alert(
        "Geçerli bir satış fiyatı gir."
      );

      focusPrice();

      return;
    }

    const stock = Number(
      product.stock || 0
    );

    const existing = cart.find(
      (item) =>
        item.product.id === product.id
    );

    /*
      Ürün zaten sepetteyse miktarı artırıyoruz.
      Mevcut satış fiyatını koruyoruz.
    */

    if (existing) {
      const newQuantity =
        existing.quantity + qty;

      if (newQuantity > stock) {
        alert(
          `Yetersiz stok.\n\nMevcut stok: ${stock}\nSepette mevcut: ${existing.quantity}\nEklemek istediğin: ${qty}`
        );

        focusQuantity();

        return;
      }

      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: newQuantity,
              }
            : item
        )
      );
    } else {
      if (qty > stock) {
        alert(
          `Yetersiz stok. Mevcut stok: ${stock}`
        );

        focusQuantity();

        return;
      }

      setCart([
        ...cart,
        {
          product,
          quantity: qty,
          unitPrice: price,
        },
      ]);
    }

    setSelectedProduct("");
    setBarcode("");
    setQuantity("1");
    setSalePrice("");

    focusBarcode();
  }

  function handleQuantityKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Enter") {
      e.preventDefault();

      addToCart();
    }
  }

  function handlePriceKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Enter") {
      e.preventDefault();

      focusQuantity();
    }
  }

  function handleBarcodeKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Enter") {
      e.preventDefault();

      handleBarcodeSearch();
    }
  }

  function removeFromCart(
    productId: string
  ) {
    setCart(
      cart.filter(
        (item) =>
          item.product.id !== productId
      )
    );

    focusBarcode();
  }

  function calculateTotal() {
    return cart.reduce(
      (total, item) => {
        return (
          total +
          item.unitPrice * item.quantity
        );
      },
      0
    );
  }

  function calculateTotalQuantity() {
    return cart.reduce(
      (total, item) =>
        total + item.quantity,
      0
    );
  }

  function formatPrice(value: number) {
    return value.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getSelectedProduct() {
    return products.find(
      (item) =>
        item.id === selectedProduct
    );
  }

  async function createOrder() {
    if (!selectedCustomer) {
      alert("Önce müşteri seç.");
      return;
    }

    if (cart.length === 0) {
      alert(
        "Siparişe en az bir ürün eklemelisin."
      );

      return;
    }

    if (creatingOrder) {
      return;
    }

    setCreatingOrder(true);

    try {
      /*
        Artık her ürünün gerçek satış fiyatını
        RPC'ye gönderiyoruz.
      */

      const items = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { data, error } =
        await supabase.rpc(
          "create_order",
          {
            p_customer_id:
              selectedCustomer,

            p_items: items,
          }
        );

      if (error) {
        console.error(error);

        alert(
          error.message ||
            "Sipariş oluşturulurken bir hata oluştu."
        );

        return;
      }

      if (!data || data.length === 0) {
        alert(
          "Sipariş oluşturuldu ancak sipariş bilgisi alınamadı."
        );

        return;
      }

      const order = data[0];

      alert(
        `Sipariş başarıyla oluşturuldu!\n\nSipariş No: #${order.result_order_number}\nToplam: ${formatPrice(
          Number(order.result_total)
        )} ₺`
      );

      setCart([]);
      setSelectedProduct("");
      setBarcode("");
      setQuantity("1");
      setSalePrice("");

      await loadData();

      focusBarcode();
    } catch (error) {
      console.error(error);

      alert(
        "Sipariş oluşturulurken beklenmeyen bir hata oluştu."
      );
    } finally {
      setCreatingOrder(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-10">
        <p className="text-slate-500">
          Sipariş ekranı hazırlanıyor...
        </p>
      </div>
    );
  }

  const selectedProductData =
    getSelectedProduct();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">

      <div className="mx-auto max-w-6xl">

        {/* BAŞLIK */}

        <div className="mb-6">

          <h1 className="text-3xl font-bold text-slate-900">
            Yeni Sipariş
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Saha satışı için hızlı sipariş oluştur.
          </p>

        </div>


        {/* MÜŞTERİ */}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">

          <div className="mb-4 flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              1
            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Müşteri
              </h2>

              <p className="text-sm text-slate-500">
                Sipariş verecek müşteriyi seç.
              </p>

            </div>

          </div>


          <select
            value={selectedCustomer}
            onChange={(e) => {

              setSelectedCustomer(
                e.target.value
              );

              setSelectedProduct("");
              setBarcode("");
              setQuantity("1");
              setSalePrice("");

              if (e.target.value) {
                focusBarcode();
              }

            }}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
          >

            <option value="">
              Müşteri seç...
            </option>

            {customers.map((customer) => (

              <option
                key={customer.id}
                value={customer.id}
              >

                {customer.company_name}

                {customer.contact_name
                  ? ` - ${customer.contact_name}`
                  : ""}

              </option>

            ))}

          </select>


          {customers.length === 0 && (

            <p className="mt-3 text-sm text-red-500">
              Henüz müşteri bulunmuyor.
            </p>

          )}

        </div>


        {/* ÜRÜN */}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">

          <div className="mb-5 flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              2
            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Ürün Ekle
              </h2>

              <p className="text-sm text-slate-500">
                Barkodu okut veya barkodu elle gir.
              </p>

            </div>

          </div>


          {/* BARKOD */}

          <div className="mb-5">

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Barkod
            </label>

            <div className="flex flex-col gap-3 md:flex-row">

              <input
                ref={barcodeInputRef}
                type="text"
                inputMode="numeric"
                value={barcode}
                onChange={(e) =>
                  setBarcode(e.target.value)
                }
                onKeyDown={
                  handleBarcodeKeyDown
                }
                placeholder="Barkodu okut veya yaz..."
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              />


              <button
                onClick={
                  handleBarcodeSearch
                }
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Barkodu Bul
              </button>


              {!scannerOpen ? (

                <button
                  onClick={startScanner}
                  disabled={scannerLoading}
                  className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {scannerLoading
                    ? "Kamera Açılıyor..."
                    : "📷 Kamerayı Aç"}

                </button>

              ) : (

                <button
                  onClick={stopScanner}
                  className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
                >
                  Kamerayı Kapat
                </button>

              )}

            </div>

          </div>


          {/* KAMERA */}

          {scannerOpen && (

            <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">

              <div className="border-b border-slate-800 px-4 py-3">

                <p className="text-sm font-semibold text-white">
                  Barkodu kameranın ortasına getir
                </p>

              </div>

              <div
                id="barcode-reader"
                className="mx-auto w-full max-w-xl"
              />

            </div>

          )}


          {/* ÜRÜN SEÇİMİ */}

          <div className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto]">

            <select
              value={selectedProduct}
              onChange={(e) => {

                const product =
                  products.find(
                    (item) =>
                      item.id ===
                      e.target.value
                  );

                if (!product) {
                  setSelectedProduct("");
                  setBarcode("");
                  setSalePrice("");
                  return;
                }

                setBarcode(
                  product.barcode || ""
                );

                prepareProduct(product);

              }}
              className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
            >

              <option value="">
                Ürün seç...
              </option>

              {products.map((product) => (

                <option
                  key={product.id}
                  value={product.id}
                >

                  {product.product_name}

                  {" | Stok: "}

                  {product.stock || 0}

                </option>

              ))}

            </select>


            {/* SATIŞ FİYATI */}

            <input
              ref={priceInputRef}
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) =>
                setSalePrice(e.target.value)
              }
              onKeyDown={
                handlePriceKeyDown
              }
              placeholder="Satış fiyatı"
              className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
            />


            {/* MİKTAR */}

            <input
              ref={quantityInputRef}
              type="number"
              min="1"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value)
              }
              onKeyDown={
                handleQuantityKeyDown
              }
              placeholder="Miktar"
              className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
            />


            <button
              onClick={addToCart}
              className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              + Sepete Ekle
            </button>

          </div>


          {/* SEÇİLEN ÜRÜN */}

          {selectedProductData && (

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">

              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Seçilen Ürün
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {
                      selectedProductData.product_name
                    }
                  </p>

                  <p className="text-sm text-slate-500">

                    Barkod:{" "}

                    {selectedProductData.barcode ||
                      "-"}

                    {" • "}

                    Stok:{" "}

                    {selectedProductData.stock ||
                      0}{" "}

                    {selectedProductData.unit ||
                      "Adet"}

                  </p>

                </div>


                <div className="text-left md:text-right">

                  <p className="text-xs text-slate-400">
                    Normal Satış Fiyatı
                  </p>

                  <p className="text-xl font-bold text-slate-900">

                    {formatPrice(
                      Number(
                        selectedProductData.retail_price ||
                          0
                      )
                    )}{" "}

                    ₺

                  </p>

                </div>

              </div>

            </div>

          )}

        </div>


        {/* SEPET */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-5 py-5 md:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                3
              </div>

              <div>

                <h2 className="text-lg font-bold text-slate-900">
                  Sipariş
                </h2>

                <p className="text-sm text-slate-500">
                  Sepetteki ürünleri kontrol et.
                </p>

              </div>

            </div>

          </div>


          {cart.length === 0 ? (

            <div className="p-10 text-center text-slate-500">
              Henüz ürün eklenmedi.
            </div>

          ) : (

            <>

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="bg-slate-50">

                    <tr>

                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                        Ürün
                      </th>

                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                        Normal Fiyat
                      </th>

                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                        Satış Fiyatı
                      </th>

                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                        Miktar
                      </th>

                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                        Toplam
                      </th>

                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                        İşlem
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-slate-100">

                    {cart.map((item) => {

                      const total =
                        item.unitPrice *
                        item.quantity;

                      const normalPrice =
                        Number(
                          item.product.retail_price ||
                            0
                        );

                      const discounted =
                        item.unitPrice <
                        normalPrice;

                      return (

                        <tr
                          key={item.product.id}
                        >

                          <td className="px-6 py-4">

                            <div className="font-semibold text-slate-900">
                              {
                                item.product
                                  .product_name
                              }
                            </div>

                            <div className="text-xs text-slate-400">
                              Barkod:{" "}
                              {item.product
                                .barcode || "-"}
                            </div>

                          </td>


                          <td className="px-6 py-4 text-right text-slate-400">

                            {formatPrice(
                              normalPrice
                            )}{" "}

                            ₺

                          </td>


                          <td className="px-6 py-4 text-right">

                            <span
                              className={
                                discounted
                                  ? "font-bold text-emerald-600"
                                  : "font-semibold text-slate-900"
                              }
                            >

                              {formatPrice(
                                item.unitPrice
                              )}{" "}

                              ₺

                            </span>

                          </td>


                          <td className="px-6 py-4 text-right font-semibold">

                            {item.quantity}{" "}

                            {item.product.unit ||
                              "Adet"}

                          </td>


                          <td className="px-6 py-4 text-right font-bold">

                            {formatPrice(total)}{" "}

                            ₺

                          </td>


                          <td className="px-6 py-4 text-right">

                            <button
                              onClick={() =>
                                removeFromCart(
                                  item.product.id
                                )
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              Sil
                            </button>

                          </td>

                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>


              {/* TOPLAM */}

              <div className="flex flex-col gap-5 border-t border-slate-200 p-5 md:flex-row md:items-center md:justify-between md:p-6">

                <div>

                  <p className="text-sm text-slate-500">
                    Genel Toplam
                  </p>

                  <p className="text-3xl font-bold text-slate-900">

                    {formatPrice(
                      calculateTotal()
                    )}{" "}

                    ₺

                  </p>

                  <p className="mt-1 text-sm text-slate-400">

                    {cart.length} farklı ürün

                    {" • "}

                    {calculateTotalQuantity()} toplam adet

                  </p>

                </div>


                <button
                  onClick={createOrder}
                  disabled={creatingOrder}
                  className="rounded-xl bg-slate-900 px-8 py-4 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {creatingOrder
                    ? "Sipariş Oluşturuluyor..."
                    : "Siparişi Oluştur"}

                </button>

              </div>

            </>

          )}

        </div>

      </div>

    </div>
  );
}
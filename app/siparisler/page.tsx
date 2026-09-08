"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
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

type Order = {
  id: string;
  order_number: number;
  customer_id: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  purchase_price: number;
};

type AccountTransaction = {
  id: string;
  transaction_type: string;
  amount: number;
  note: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: "Yeni",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const STATUS_CLASSES: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  preparing: "bg-amber-50 text-amber-700 border-amber-200",
  shipped: "bg-purple-50 text-purple-700 border-purple-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_STEPS = [
  {
    key: "new",
    label: "Yeni",
  },
  {
    key: "preparing",
    label: "Hazırlanıyor",
  },
  {
    key: "shipped",
    label: "Kargoda",
  },
  {
    key: "completed",
    label: "Tamamlandı",
  },
];

export default function OrdersPage() {
  const [activeView, setActiveView] = useState<"orders" | "new">("orders");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [accountTransactions, setAccountTransactions] = useState<
    AccountTransaction[]
  >([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState(false);

  // Yeni sipariş
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [barcode, setBarcode] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStartedRef = useRef(false);

  useEffect(() => {
    loadInitialData();

    return () => {
      stopScanner();
    };
  }, []);

  async function loadInitialData() {
    setLoading(true);

    await Promise.all([
      loadCustomers(),
      loadProducts(),
      loadOrders(),
    ]);

    setLoading(false);
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id, company_name, contact_name, phone")
      .order("company_name");

    if (error) {
      console.error(error);
      alert("Müşteriler yüklenemedi.");
      return;
    }

    setCustomers(data || []);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, product_name, barcode, retail_price, stock, unit"
      )
      .eq("is_active", true)
      .order("product_name");

    if (error) {
      console.error(error);
      alert("Ürünler yüklenemedi.");
      return;
    }

    setProducts(data || []);
  }

  async function loadOrders() {
    setOrdersLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_id, status, subtotal, total, notes, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Siparişler yüklenemedi.");
      setOrdersLoading(false);
      return;
    }

    setOrders(data || []);
    setOrdersLoading(false);
  }

  function formatPrice(value: number) {
    return value.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDateShort(value: string) {
    return new Date(value).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function getCustomer(customerId: string) {
    return customers.find(
      (customer) => customer.id === customerId
    );
  }

  function getStatusLabel(status: string) {
    return STATUS_LABELS[status] || status;
  }

  function getStatusClass(status: string) {
    return (
      STATUS_CLASSES[status] ||
      "bg-slate-50 text-slate-700 border-slate-200"
    );
  }

  function getOrderItemCount(order: Order) {
    if (
      selectedOrder &&
      selectedOrder.id === order.id
    ) {
      return selectedOrderItems.length;
    }

    return null;
  }

  const filteredOrders = orders.filter((order) => {
    const customer = getCustomer(order.customer_id);

    const searchText = search.trim().toLowerCase();

    const matchesSearch =
      !searchText ||
      String(order.order_number).includes(searchText) ||
      customer?.company_name
        ?.toLowerCase()
        .includes(searchText) ||
      customer?.contact_name
        ?.toLowerCase()
        .includes(searchText) ||
      customer?.phone
        ?.toLowerCase()
        .includes(searchText);

    const matchesStatus =
      statusFilter === "all" ||
      order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const orderStats = {
    all: orders.length,
    new: orders.filter(
      (order) => order.status === "new"
    ).length,
    preparing: orders.filter(
      (order) => order.status === "preparing"
    ).length,
    shipped: orders.filter(
      (order) => order.status === "shipped"
    ).length,
    completed: orders.filter(
      (order) => order.status === "completed"
    ).length,
    cancelled: orders.filter(
      (order) => order.status === "cancelled"
    ).length,
  };

  const activeOrderCount =
    orderStats.new +
    orderStats.preparing +
    orderStats.shipped;

  async function openOrder(order: Order) {
    setSelectedOrder(order);
    setSelectedOrderItems([]);
    setAccountTransactions([]);
    setAccountError(false);
    setInvoiceMode(false);

    setDetailLoading(true);
    setAccountLoading(true);

    const [itemsResult, accountResult] =
      await Promise.all([
        supabase
          .from("order_items")
          .select(
            "id, product_id, product_name, barcode, quantity, unit_price, total_price, purchase_price"
          )
          .eq("order_id", order.id)
          .order("created_at"),

        supabase
          .from("account_transactions")
          .select(
            "id, transaction_type, amount, note, created_at"
          )
          .eq("customer_id", order.customer_id)
          .order("created_at", {
            ascending: false,
          })
          .limit(100),
      ]);

    if (itemsResult.error) {
      console.error(itemsResult.error);
      alert("Sipariş detayları yüklenemedi.");
    } else {
      setSelectedOrderItems(
        itemsResult.data || []
      );
    }

    if (accountResult.error) {
      console.error(accountResult.error);
      setAccountError(true);
    } else {
      setAccountTransactions(
        accountResult.data || []
      );
    }

    setDetailLoading(false);
    setAccountLoading(false);
  }

  function closeOrder() {
    if (
      updatingStatus ||
      cancellingOrder
    ) {
      return;
    }

    setSelectedOrder(null);
    setSelectedOrderItems([]);
    setAccountTransactions([]);
    setInvoiceMode(false);
  }

  async function updateStatus(newStatus: string) {
    if (!selectedOrder) {
      return;
    }

    if (updatingStatus) {
      return;
    }

    setUpdatingStatus(true);

    try {
      const { error } = await supabase.rpc(
        "update_order_status",
        {
          p_order_id: selectedOrder.id,
          p_new_status: newStatus,
        }
      );

      if (error) {
        console.error(error);
        alert(
          error.message ||
            "Sipariş durumu güncellenemedi."
        );
        return;
      }

      const updatedOrder = {
        ...selectedOrder,
        status: newStatus,
      };

      setSelectedOrder(updatedOrder);

      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrder.id
            ? updatedOrder
            : order
        )
      );
    } catch (error) {
      console.error(error);
      alert(
        "Sipariş durumu değiştirilirken hata oluştu."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function cancelOrder() {
    if (!selectedOrder) {
      return;
    }

    if (cancellingOrder) {
      return;
    }

    const confirmed = window.confirm(
      `#${selectedOrder.order_number} numaralı siparişi iptal etmek istediğine emin misin?\n\nBu işlem siparişteki ürünlerin stoklarını geri ekleyecek ve müşteri carisini geri alacaktır.\n\nBu işlem geri alınamaz.`
    );

    if (!confirmed) {
      return;
    }

    setCancellingOrder(true);

    try {
      const { data, error } =
        await supabase.rpc(
          "cancel_order",
          {
            p_order_id: selectedOrder.id,
          }
        );

      if (error) {
        console.error(error);
        alert(
          error.message ||
            "Sipariş iptal edilemedi."
        );
        return;
      }

      const result = data?.[0];

      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                status: "cancelled",
              }
            : order
        )
      );

      setSelectedOrder({
        ...selectedOrder,
        status: "cancelled",
      });

      await Promise.all([
        loadProducts(),
        loadOrders(),
      ]);

      alert(
        `Sipariş #${selectedOrder.order_number} iptal edildi.\n\n${
          result?.result_restored_items || 0
        } ürün kalemi stoklara geri eklendi.`
      );

      await openOrder({
        ...selectedOrder,
        status: "cancelled",
      });
    } catch (error) {
      console.error(error);
      alert(
        "Sipariş iptal edilirken beklenmeyen bir hata oluştu."
      );
    } finally {
      setCancellingOrder(false);
    }
  }

  function startNewOrder() {
    setSelectedCustomer("");
    setSelectedProduct("");
    setQuantity("1");
    setBarcode("");
    setSalePrice("");
    setCart([]);
    setActiveView("new");

    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
  }

  function backToOrders() {
    stopScanner();

    setActiveView("orders");

    setSelectedCustomer("");
    setSelectedProduct("");
    setQuantity("1");
    setBarcode("");
    setSalePrice("");
    setCart([]);

    loadOrders();
    loadProducts();
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

  function findProductByBarcode(code: string) {
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
      (item) => item.product.id === product.id
    );

    if (existing) {
      setQuantity(String(existing.quantity));
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

          const product = products.find(
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
        () => {}
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
      alert("Önce barkod okut veya ürün seç.");
      return;
    }

    const product = products.find(
      (item) => item.id === selectedProduct
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
      alert("Geçerli bir satış fiyatı gir.");
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
                unitPrice: price,
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

  function removeFromCart(productId: string) {
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
      (total, item) =>
        total +
        item.unitPrice * item.quantity,
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

  function getSelectedProduct() {
    return products.find(
      (item) => item.id === selectedProduct
    );
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

      await Promise.all([
        loadOrders(),
        loadProducts(),
      ]);

      setActiveView("orders");
    } catch (error) {
      console.error(error);

      alert(
        "Sipariş oluşturulurken beklenmeyen bir hata oluştu."
      );
    } finally {
      setCreatingOrder(false);
    }
  }

  function getSelectedOrderTotalQuantity() {
    return selectedOrderItems.reduce(
      (total, item) =>
        total + Number(item.quantity || 0),
      0
    );
  }

  function getSelectedOrderProfit() {
    return selectedOrderItems.reduce(
      (total, item) =>
        total +
        (Number(item.unit_price) -
          Number(item.purchase_price)) *
          Number(item.quantity),
      0
    );
  }

  function getCustomerAccountBalance() {
    let balance = 0;

    for (const transaction of accountTransactions) {
      const type =
        transaction.transaction_type;

      const amount = Number(
        transaction.amount || 0
      );

      if (type === "sale") {
        balance += amount;
      } else if (
        type === "refund" ||
        type === "payment" ||
        type === "collection"
      ) {
        balance -= amount;
      }
    }

    return balance;
  }

  function getAccountTransactionLabel(
    type: string
  ) {
    const labels: Record<string, string> = {
      sale: "Satış",
      refund: "İade",
      payment: "Ödeme",
      collection: "Tahsilat",
    };

    return labels[type] || type;
  }

  function getNextStatus(status: string) {
    if (status === "new") {
      return "preparing";
    }

    if (status === "preparing") {
      return "shipped";
    }

    if (status === "shipped") {
      return "completed";
    }

    return null;
  }

  function getCurrentStatusIndex(
    status: string
  ) {
    return STATUS_STEPS.findIndex(
      (step) => step.key === status
    );
  }

  function printOrder() {
    setInvoiceMode(true);

    setTimeout(() => {
      window.print();
    }, 150);
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

  /*
   * =========================================================
   * SİPARİŞLER LİSTESİ
   * =========================================================
   */

  if (activeView === "orders") {
    return (
      <>
        <style jsx global>{`
          @media print {
            body {
              background: white !important;
            }

            body * {
              visibility: hidden;
            }

            .print-invoice,
            .print-invoice * {
              visibility: visible;
            }

            .print-invoice {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              padding: 30px;
            }

            @page {
              size: A4;
              margin: 12mm;
            }
          }
        `}</style>

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">

            {/* BAŞLIK */}

            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Siparişler
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Oluşturulan siparişleri yönet.
                </p>
              </div>

              <button
                onClick={startNewOrder}
                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                + Yeni Sipariş
              </button>

            </div>

            {/* İSTATİSTİKLER */}

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">

              <button
                onClick={() =>
                  setStatusFilter("all")
                }
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                  statusFilter === "all"
                    ? "border-slate-400 ring-2 ring-slate-100"
                    : "border-slate-200"
                }`}
              >
                <p className="text-xs font-semibold text-slate-400">
                  TOPLAM
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {orderStats.all}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Tüm siparişler
                </p>
              </button>

              <button
                onClick={() =>
                  setStatusFilter("new")
                }
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                  statusFilter === "new"
                    ? "border-blue-300 ring-2 ring-blue-50"
                    : "border-slate-200"
                }`}
              >
                <p className="text-xs font-semibold text-blue-500">
                  YENİ
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {orderStats.new}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Bekleyen
                </p>
              </button>

              <button
                onClick={() =>
                  setStatusFilter("preparing")
                }
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                  statusFilter === "preparing"
                    ? "border-amber-300 ring-2 ring-amber-50"
                    : "border-slate-200"
                }`}
              >
                <p className="text-xs font-semibold text-amber-600">
                  HAZIRLANIYOR
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {orderStats.preparing}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Hazırlanan
                </p>
              </button>

              <button
                onClick={() =>
                  setStatusFilter("shipped")
                }
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                  statusFilter === "shipped"
                    ? "border-purple-300 ring-2 ring-purple-50"
                    : "border-slate-200"
                }`}
              >
                <p className="text-xs font-semibold text-purple-600">
                  KARGODA
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {orderStats.shipped}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Sevkiyatta
                </p>
              </button>

              <button
                onClick={() =>
                  setStatusFilter("completed")
                }
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                  statusFilter === "completed"
                    ? "border-emerald-300 ring-2 ring-emerald-50"
                    : "border-slate-200"
                }`}
              >
                <p className="text-xs font-semibold text-emerald-600">
                  TAMAMLANDI
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {orderStats.completed}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Teslim edilen
                </p>
              </button>

              <button
                onClick={() =>
                  setStatusFilter("cancelled")
                }
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                  statusFilter === "cancelled"
                    ? "border-red-300 ring-2 ring-red-50"
                    : "border-slate-200"
                }`}
              >
                <p className="text-xs font-semibold text-red-600">
                  İPTAL
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {orderStats.cancelled}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  İptal edilen
                </p>
              </button>

            </div>

            {/* AKTİF SİPARİŞ BİLGİSİ */}

            {activeOrderCount > 0 && (
              <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <strong>
                  {activeOrderCount}
                </strong>{" "}
                sipariş şu anda işlem bekliyor.
              </div>
            )}

            {/* ARAMA / FİLTRE */}

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

              <div className="grid gap-3 md:grid-cols-[1fr_220px]">

                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Sipariş no, müşteri, kişi veya telefon ara..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-10 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />

                  {search && (
                    <button
                      onClick={() =>
                        setSearch("")
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value
                    )
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="all">
                    Tüm Durumlar
                  </option>

                  <option value="new">
                    Yeni ({orderStats.new})
                  </option>

                  <option value="preparing">
                    Hazırlanıyor (
                    {orderStats.preparing})
                  </option>

                  <option value="shipped">
                    Kargoda ({orderStats.shipped})
                  </option>

                  <option value="completed">
                    Tamamlandı (
                    {orderStats.completed})
                  </option>

                  <option value="cancelled">
                    İptal ({orderStats.cancelled})
                  </option>
                </select>

              </div>

              {(search ||
                statusFilter !== "all") && (
                <div className="mt-3 flex items-center justify-between gap-3">

                  <p className="text-sm text-slate-500">
                    <strong className="text-slate-800">
                      {filteredOrders.length}
                    </strong>{" "}
                    sipariş bulundu.
                  </p>

                  <button
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Filtreleri temizle
                  </button>

                </div>
              )}

            </div>

            {/* SİPARİŞ LİSTESİ */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              {ordersLoading ? (
                <div className="p-12 text-center text-slate-500">
                  Siparişler yükleniyor...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-12 text-center">

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
                    📦
                  </div>

                  <p className="mt-4 font-semibold text-slate-700">
                    Sipariş bulunamadı.
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Arama veya filtre kriterlerini değiştirebilirsin.
                  </p>

                </div>
              ) : (
                <>
                  {/* MASAÜSTÜ */}

                  <div className="hidden overflow-x-auto md:block">

                    <table className="w-full">

                      <thead className="bg-slate-50">

                        <tr>

                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                            Sipariş
                          </th>

                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                            Müşteri
                          </th>

                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                            Ürün
                          </th>

                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                            Tarih
                          </th>

                          <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-400">
                            Toplam
                          </th>

                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                            Durum
                          </th>

                          <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-400">
                            İşlem
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {filteredOrders.map(
                          (order) => {

                            const customer =
                              getCustomer(
                                order.customer_id
                              );

                            return (
                              <tr
                                key={order.id}
                                className="transition hover:bg-slate-50"
                              >

                                <td className="px-5 py-4">

                                  <p className="font-bold text-slate-900">
                                    #
                                    {
                                      order.order_number
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-slate-400">
                                    {order.status ===
                                    "cancelled"
                                      ? "İptal edildi"
                                      : "Sipariş"}
                                  </p>

                                </td>

                                <td className="px-5 py-4">

                                  <p className="font-semibold text-slate-900">
                                    {customer?.company_name ||
                                      "Bilinmeyen müşteri"}
                                  </p>

                                  {customer?.contact_name && (
                                    <p className="mt-1 text-sm text-slate-500">
                                      {
                                        customer.contact_name
                                      }
                                    </p>
                                  )}

                                  {customer?.phone && (
                                    <p className="mt-1 text-xs text-slate-400">
                                      {
                                        customer.phone
                                      }
                                    </p>
                                  )}

                                </td>

                                <td className="px-5 py-4">

                                  <p className="font-semibold text-slate-700">
                                    {getOrderItemCount(
                                      order
                                    ) !== null
                                      ? `${getOrderItemCount(
                                          order
                                        )} ürün`
                                      : "Detayda gör"}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-400">
                                    Sipariş detayında ürünler
                                  </p>

                                </td>

                                <td className="px-5 py-4 text-sm text-slate-600">
                                  {formatDate(
                                    order.created_at
                                  )}
                                </td>

                                <td className="px-5 py-4 text-right">

                                  <p className="font-bold text-slate-900">
                                    {formatPrice(
                                      Number(
                                        order.total
                                      )
                                    )}{" "}
                                    ₺
                                  </p>

                                </td>

                                <td className="px-5 py-4">

                                  <span
                                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                                      order.status
                                    )}`}
                                  >
                                    {getStatusLabel(
                                      order.status
                                    )}
                                  </span>

                                </td>

                                <td className="px-5 py-4 text-right">

                                  <button
                                    onClick={() =>
                                      openOrder(
                                        order
                                      )
                                    }
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                  >
                                    Detay
                                  </button>

                                </td>

                              </tr>
                            );
                          }
                        )}

                      </tbody>

                    </table>

                  </div>

                  {/* MOBİL */}

                  <div className="divide-y divide-slate-100 md:hidden">

                    {filteredOrders.map(
                      (order) => {

                        const customer =
                          getCustomer(
                            order.customer_id
                          );

                        return (
                          <button
                            key={order.id}
                            onClick={() =>
                              openOrder(
                                order
                              )
                            }
                            className="w-full p-4 text-left transition active:bg-slate-100"
                          >

                            <div className="flex items-start justify-between gap-3">

                              <div className="min-w-0">

                                <p className="font-bold text-slate-900">
                                  #
                                  {
                                    order.order_number
                                  }
                                </p>

                                <p className="mt-1 truncate font-semibold text-slate-700">
                                  {customer?.company_name ||
                                    "Bilinmeyen müşteri"}
                                </p>

                                {customer?.contact_name && (
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {
                                      customer.contact_name
                                    }
                                  </p>
                                )}

                              </div>

                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                                  order.status
                                )}`}
                              >
                                {getStatusLabel(
                                  order.status
                                )}
                              </span>

                            </div>

                            <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">

                              <div>

                                <p className="text-xs text-slate-400">
                                  {formatDateShort(
                                    order.created_at
                                  )}
                                </p>

                                <p className="mt-1 text-xs font-medium text-slate-500">
                                  Sipariş detayını görüntüle →
                                </p>

                              </div>

                              <p className="text-lg font-bold text-slate-900">
                                {formatPrice(
                                  Number(
                                    order.total
                                  )
                                )}{" "}
                                ₺
                              </p>

                            </div>

                          </button>
                        );
                      }
                    )}

                  </div>
                </>
              )}

            </div>

            <div className="mt-4 text-sm text-slate-400">
              {filteredOrders.length} sipariş gösteriliyor.
            </div>

          </div>

          {/* DETAY MODALI */}

          {selectedOrder && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 md:p-4"
              onMouseDown={(e) => {
                if (
                  e.target ===
                  e.currentTarget
                ) {
                  closeOrder();
                }
              }}
            >

              <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

                {/* MODAL HEADER */}

                <div className="sticky top-0 z-20 border-b border-slate-200 bg-white p-4 md:p-5">

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Sipariş Detayı
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-3">

                        <h2 className="text-2xl font-bold text-slate-900">
                          #
                          {
                            selectedOrder.order_number
                          }
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                            selectedOrder.status
                          )}`}
                        >
                          {getStatusLabel(
                            selectedOrder.status
                          )}
                        </span>

                      </div>

                    </div>

                    <div className="flex items-center gap-2">

                      <button
                        onClick={printOrder}
                        disabled={
                          detailLoading ||
                          selectedOrderItems.length ===
                            0
                        }
                        className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:block"
                      >
                        🖨 Yazdır / PDF
                      </button>

                      <button
                        onClick={closeOrder}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-slate-500 hover:bg-slate-50"
                      >
                        ✕
                      </button>

                    </div>

                  </div>

                  {/* MOBİL YAZDIR */}

                  <button
                    onClick={printOrder}
                    disabled={
                      detailLoading ||
                      selectedOrderItems.length ===
                        0
                    }
                    className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:hidden"
                  >
                    🖨 Yazdır / PDF Olarak Kaydet
                  </button>

                </div>

                <div className="space-y-6 p-4 md:p-6">

                  {/* MÜŞTERİ */}

                  <div className="grid gap-4 lg:grid-cols-3">

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">

                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Müşteri
                      </p>

                      <p className="text-lg font-bold text-slate-900">
                        {getCustomer(
                          selectedOrder.customer_id
                        )?.company_name ||
                          "Bilinmeyen müşteri"}
                      </p>

                      {getCustomer(
                        selectedOrder.customer_id
                      )?.contact_name && (
                        <p className="mt-1 text-sm text-slate-600">
                          {
                            getCustomer(
                              selectedOrder.customer_id
                            )?.contact_name
                          }
                        </p>
                      )}

                      {getCustomer(
                        selectedOrder.customer_id
                      )?.phone && (
                        <p className="mt-2 text-sm text-slate-500">
                          📞{" "}
                          {
                            getCustomer(
                              selectedOrder.customer_id
                            )?.phone
                          }
                        </p>
                      )}

                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">

                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Sipariş Tarihi
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {formatDate(
                          selectedOrder.created_at
                        )}
                      </p>

                    </div>

                  </div>

                  {/* DURUM AKIŞI */}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">

                    <div className="mb-5 flex items-center justify-between">

                      <div>
                        <h3 className="font-bold text-slate-900">
                          Sipariş Durumu
                        </h3>

                        <p className="mt-1 text-xs text-slate-400">
                          Siparişin mevcut aşaması
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                          selectedOrder.status
                        )}`}
                      >
                        {getStatusLabel(
                          selectedOrder.status
                        )}
                      </span>

                    </div>

                    {selectedOrder.status ===
                    "cancelled" ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">

                        <div className="flex gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                            ❌
                          </div>

                          <div>

                            <p className="font-bold text-red-700">
                              Bu sipariş iptal edilmiştir.
                            </p>

                            <p className="mt-1 text-sm text-red-600">
                              Siparişin stok ve cari kayıtları geri alınmıştır.
                            </p>

                            <p className="mt-2 text-sm font-semibold text-red-600">
                              İptal edilen sipariş tekrar aktif duruma getirilemez.
                            </p>

                          </div>

                        </div>

                      </div>
                    ) : (
                      <>
                        <div className="flex items-center">

                          {STATUS_STEPS.map(
                            (step, index) => {

                              const currentIndex =
                                getCurrentStatusIndex(
                                  selectedOrder.status
                                );

                              const completed =
                                index <=
                                currentIndex;

                              return (
                                <div
                                  key={step.key}
                                  className="flex flex-1 items-center"
                                >

                                  <div className="flex flex-col items-center">

                                    <div
                                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                        completed
                                          ? "border-slate-900 bg-slate-900 text-white"
                                          : "border-slate-200 bg-white text-slate-400"
                                      }`}
                                    >
                                      {completed
                                        ? "✓"
                                        : index + 1}
                                    </div>

                                    <p
                                      className={`mt-2 text-center text-[10px] font-semibold sm:text-xs ${
                                        completed
                                          ? "text-slate-900"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {step.label}
                                    </p>

                                  </div>

                                  {index <
                                    STATUS_STEPS.length -
                                      1 && (
                                    <div
                                      className={`mx-1 h-0.5 flex-1 ${
                                        index <
                                        currentIndex
                                          ? "bg-slate-900"
                                          : "bg-slate-200"
                                      }`}
                                    />
                                  )}

                                </div>
                              );
                            }
                          )}

                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">

                          {getNextStatus(
                            selectedOrder.status
                          ) && (
                            <button
                              onClick={() =>
                                updateStatus(
                                  getNextStatus(
                                    selectedOrder.status
                                  )!
                                )
                              }
                              disabled={
                                updatingStatus ||
                                cancellingOrder
                              }
                              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              {updatingStatus
                                ? "Güncelleniyor..."
                                : selectedOrder.status ===
                                  "new"
                                ? "Hazırlanmaya Al →"
                                : selectedOrder.status ===
                                  "preparing"
                                ? "Kargoya Ver →"
                                : "Tamamlandı Yap →"}
                            </button>
                          )}

                          {selectedOrder.status !==
                            "cancelled" && (
                            <button
                              onClick={
                                cancelOrder
                              }
                              disabled={
                                updatingStatus ||
                                cancellingOrder
                              }
                              className="rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {cancellingOrder
                                ? "İptal Ediliyor..."
                                : "Siparişi İptal Et"}
                            </button>
                          )}

                        </div>
                      </>
                    )}

                  </div>

                  {/* ÖZET KARTLARI */}

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                    <div className="rounded-xl border border-slate-200 p-4">

                      <p className="text-xs font-semibold text-slate-400">
                        FARKLI ÜRÜN
                      </p>

                      <p className="mt-2 text-xl font-bold text-slate-900">
                        {selectedOrderItems.length}
                      </p>

                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">

                      <p className="text-xs font-semibold text-slate-400">
                        TOPLAM ADET
                      </p>

                      <p className="mt-2 text-xl font-bold text-slate-900">
                        {getSelectedOrderTotalQuantity()}
                      </p>

                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">

                      <p className="text-xs font-semibold text-slate-400">
                        SİPARİŞ TOPLAMI
                      </p>

                      <p className="mt-2 text-xl font-bold text-slate-900">
                        {formatPrice(
                          Number(
                            selectedOrder.total
                          )
                        )}{" "}
                        ₺
                      </p>

                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">

                      <p className="text-xs font-semibold text-slate-400">
                        TAHMİNİ KÂR
                      </p>

                      <p
                        className={`mt-2 text-xl font-bold ${
                          getSelectedOrderProfit() >=
                          0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatPrice(
                          getSelectedOrderProfit()
                        )}{" "}
                        ₺
                      </p>

                    </div>

                  </div>

                  {/* ÜRÜNLER */}

                  <div>

                    <div className="mb-3 flex items-center justify-between">

                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          Sipariş Ürünleri
                        </h3>

                        <p className="text-sm text-slate-400">
                          Siparişteki ürünlerin detayları
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {
                          selectedOrderItems.length
                        }{" "}
                        ürün
                      </span>

                    </div>

                    {detailLoading ? (
                      <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
                        Ürünler yükleniyor...
                      </div>
                    ) : selectedOrderItems.length ===
                      0 ? (
                      <div className="rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                        Bu siparişte ürün bulunamadı.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200">

                        <div className="overflow-x-auto">

                          <table className="w-full">

                            <thead className="bg-slate-50">

                              <tr>

                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Ürün
                                </th>

                                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Miktar
                                </th>

                                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Birim
                                </th>

                                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Toplam
                                </th>

                              </tr>

                            </thead>

                            <tbody className="divide-y divide-slate-100">

                              {selectedOrderItems.map(
                                (item) => (
                                  <tr
                                    key={
                                      item.id
                                    }
                                    className="hover:bg-slate-50"
                                  >

                                    <td className="px-4 py-4">

                                      <p className="font-semibold text-slate-900">
                                        {
                                          item.product_name
                                        }
                                      </p>

                                      {item.barcode && (
                                        <p className="mt-1 text-xs text-slate-400">
                                          Barkod:{" "}
                                          {
                                            item.barcode
                                          }
                                        </p>
                                      )}

                                    </td>

                                    <td className="px-4 py-4 text-right font-semibold text-slate-700">
                                      {
                                        item.quantity
                                      }
                                    </td>

                                    <td className="px-4 py-4 text-right text-slate-600">
                                      {formatPrice(
                                        Number(
                                          item.unit_price
                                        )
                                      )}{" "}
                                      ₺
                                    </td>

                                    <td className="px-4 py-4 text-right font-bold text-slate-900">
                                      {formatPrice(
                                        Number(
                                          item.total_price
                                        )
                                      )}{" "}
                                      ₺
                                    </td>

                                  </tr>
                                )
                              )}

                            </tbody>

                          </table>

                        </div>

                      </div>
                    )}

                  </div>

                  {/* CARİ */}

                  <div className="rounded-2xl border border-slate-200 bg-white">

                    <div className="border-b border-slate-200 p-4 md:p-5">

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <h3 className="font-bold text-slate-900">
                            Müşteri Cari Bilgisi
                          </h3>

                          <p className="mt-1 text-sm text-slate-400">
                            Müşterinin son cari hareketleri
                          </p>

                        </div>

                        {!accountLoading &&
                          !accountError && (
                            <div className="text-left sm:text-right">

                              <p className="text-xs text-slate-400">
                                Güncel Bakiye
                              </p>

                              <p
                                className={`text-xl font-bold ${
                                  getCustomerAccountBalance() >
                                  0
                                    ? "text-red-600"
                                    : getCustomerAccountBalance() <
                                      0
                                    ? "text-emerald-600"
                                    : "text-slate-900"
                                }`}
                              >
                                {formatPrice(
                                  Math.abs(
                                    getCustomerAccountBalance()
                                  )
                                )}{" "}
                                ₺
                              </p>

                              <p className="text-xs text-slate-400">
                                {getCustomerAccountBalance() >
                                0
                                  ? "Müşteri borcu"
                                  : getCustomerAccountBalance() <
                                    0
                                  ? "Müşteriden alacak"
                                  : "Bakiye yok"}
                              </p>

                            </div>
                          )}

                      </div>

                    </div>

                    {accountLoading ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        Cari bilgileri yükleniyor...
                      </div>
                    ) : accountError ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        Cari hareketleri yüklenemedi.
                      </div>
                    ) : accountTransactions.length ===
                      0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        Bu müşterinin cari hareketi bulunmuyor.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">

                        <div className="divide-y divide-slate-100">

                          {accountTransactions
                            .slice(0, 10)
                            .map(
                              (
                                transaction
                              ) => {

                                const isDebit =
                                  transaction.transaction_type ===
                                  "sale";

                                return (
                                  <div
                                    key={
                                      transaction.id
                                    }
                                    className="flex items-center justify-between gap-4 px-4 py-3"
                                  >

                                    <div className="min-w-0">

                                      <p className="font-semibold text-slate-800">
                                        {getAccountTransactionLabel(
                                          transaction.transaction_type
                                        )}
                                      </p>

                                      <p className="mt-1 truncate text-xs text-slate-400">
                                        {transaction.note ||
                                          "Cari hareket"}
                                      </p>

                                      <p className="mt-1 text-xs text-slate-400">
                                        {formatDate(
                                          transaction.created_at
                                        )}
                                      </p>

                                    </div>

                                    <p
                                      className={`shrink-0 font-bold ${
                                        isDebit
                                          ? "text-red-600"
                                          : "text-emerald-600"
                                      }`}
                                    >
                                      {isDebit
                                        ? "+"
                                        : "-"}
                                      {formatPrice(
                                        Number(
                                          transaction.amount
                                        )
                                      )}{" "}
                                      ₺
                                    </p>

                                  </div>
                                );
                              }
                            )}

                        </div>

                      </div>
                    )}

                  </div>

                  {/* TOPLAM */}

                  <div className="flex justify-end">

                    <div className="w-full rounded-2xl bg-slate-50 p-5 md:w-96">

                      <div className="flex justify-between text-sm text-slate-500">
                        <span>
                          Ara toplam
                        </span>

                        <span>
                          {formatPrice(
                            Number(
                              selectedOrder.subtotal
                            )
                          )}{" "}
                          ₺
                        </span>
                      </div>

                      <div className="mt-3 flex justify-between border-t border-slate-200 pt-3">

                        <span className="font-bold text-slate-900">
                          Genel Toplam
                        </span>

                        <span className="text-2xl font-bold text-slate-900">
                          {formatPrice(
                            Number(
                              selectedOrder.total
                            )
                          )}{" "}
                          ₺
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* İPTAL / TAMAMLANMA */}

                  {selectedOrder.status ===
                    "completed" && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">

                      <p className="font-bold text-emerald-700">
                        ✓ Bu sipariş tamamlanmıştır.
                      </p>

                      <p className="mt-1 text-sm text-emerald-600">
                        Sipariş süreci başarıyla tamamlandı.
                      </p>

                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

          {/* YAZDIRILABİLİR FATURA */}

          {selectedOrder &&
            selectedOrderItems.length > 0 && (
              <div
                className={`print-invoice hidden ${
                  invoiceMode
                    ? "print:block"
                    : ""
                }`}
              >

               <div className="mx-auto max-w-3xl">

  <div className="mb-8 flex items-start justify-between border-b-2 border-slate-900 pb-5">

    <div>
      <img
        src="/esoralogo.png"
        alt="ESORA"
        className="h-16 w-auto object-contain"
      />

      <p className="mt-1 text-sm text-slate-500">
        Sipariş / Fatura Belgesi
      </p>
    </div>

    <div className="text-right">

      <p className="text-sm text-slate-500">
        Sipariş No
      </p>

                      <p className="text-2xl font-bold text-slate-900">
                        #
                        {
                          selectedOrder.order_number
                        }
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(
                          selectedOrder.created_at
                        )}
                      </p>

                    </div>

                  </div>

                  <div className="mb-8 grid grid-cols-2 gap-8">

                    <div>

                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Müşteri
                      </p>

                      <p className="font-bold text-slate-900">
                        {getCustomer(
                          selectedOrder.customer_id
                        )?.company_name ||
                          "Bilinmeyen müşteri"}
                      </p>

                      {getCustomer(
                        selectedOrder.customer_id
                      )?.contact_name && (
                        <p className="mt-1 text-sm text-slate-600">
                          {
                            getCustomer(
                              selectedOrder.customer_id
                            )?.contact_name
                          }
                        </p>
                      )}

                      {getCustomer(
                        selectedOrder.customer_id
                      )?.phone && (
                        <p className="mt-1 text-sm text-slate-600">
                          {
                            getCustomer(
                              selectedOrder.customer_id
                            )?.phone
                          }
                        </p>
                      )}

                    </div>

                    <div className="text-right">

                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Durum
                      </p>

                      <p className="font-bold text-slate-900">
                        {getStatusLabel(
                          selectedOrder.status
                        )}
                      </p>

                    </div>

                  </div>

                  <table className="mb-8 w-full border-collapse">

                    <thead>

                      <tr className="border-y-2 border-slate-900">

                        <th className="py-3 text-left text-sm font-bold">
                          Ürün
                        </th>

                        <th className="py-3 text-right text-sm font-bold">
                          Miktar
                        </th>

                        <th className="py-3 text-right text-sm font-bold">
                          Birim Fiyat
                        </th>

                        <th className="py-3 text-right text-sm font-bold">
                          Toplam
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {selectedOrderItems.map(
                        (item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-200"
                          >

                            <td className="py-3 text-sm">

                              <p className="font-semibold">
                                {
                                  item.product_name
                                }
                              </p>

                              {item.barcode && (
                                <p className="text-xs text-slate-400">
                                  {
                                    item.barcode
                                  }
                                </p>
                              )}

                            </td>

                            <td className="py-3 text-right text-sm">
                              {
                                item.quantity
                              }
                            </td>

                            <td className="py-3 text-right text-sm">
                              {formatPrice(
                                Number(
                                  item.unit_price
                                )
                              )}{" "}
                              ₺
                            </td>

                            <td className="py-3 text-right text-sm font-bold">
                              {formatPrice(
                                Number(
                                  item.total_price
                                )
                              )}{" "}
                              ₺
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                  <div className="ml-auto w-80">

                    <div className="flex justify-between py-2 text-sm">
                      <span>
                        Ara toplam
                      </span>

                      <span>
                        {formatPrice(
                          Number(
                            selectedOrder.subtotal
                          )
                        )}{" "}
                        ₺
                      </span>
                    </div>

                    <div className="flex justify-between border-t-2 border-slate-900 py-3 text-lg font-bold">
                      <span>
                        GENEL TOPLAM
                      </span>

                      <span>
                        {formatPrice(
                          Number(
                            selectedOrder.total
                          )
                        )}{" "}
                        ₺
                      </span>
                    </div>

                  </div>

                  <div className="mt-16 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
                    Bu belge ESORA sipariş yönetim sistemi üzerinden oluşturulmuştur.
                  </div>

                </div>

              </div>
            )}

        </div>
      </>
    );
  }

  /*
   * =========================================================
   * YENİ SİPARİŞ
   * =========================================================
   */

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">

      <div className="mx-auto max-w-6xl">

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Yeni Sipariş
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Saha satışı için hızlı sipariş oluştur.
            </p>
          </div>

          <button
            onClick={backToOrders}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Siparişlere Dön
          </button>

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
                onClick={handleBarcodeSearch}
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

          {selectedProductData && (

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">

              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Seçilen Ürün
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {selectedProductData.product_name}
                  </p>

                  <p className="text-sm text-slate-500">

                    Barkod:{" "}
                    {selectedProductData.barcode || "-"}

                    {" • "}

                    Stok:{" "}
                    {selectedProductData.stock || 0}{" "}

                    {selectedProductData.unit || "Adet"}

                  </p>

                </div>

                <div className="text-left md:text-right">

                  <p className="text-xs text-slate-400">
                    Normal Satış Fiyatı
                  </p>

                  <p className="text-xl font-bold text-slate-900">

                    {formatPrice(
                      Number(
                        selectedProductData.retail_price || 0
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
                          item.product.retail_price || 0
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
                              {item.product.product_name}
                            </div>

                            <div className="text-xs text-slate-400">
                              Barkod:{" "}
                              {item.product.barcode || "-"}
                            </div>

                          </td>

                          <td className="px-6 py-4 text-right text-slate-400">

                            {formatPrice(
                              normalPrice
                            )} ₺

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
                              )} ₺

                            </span>

                          </td>

                          <td className="px-6 py-4 text-right font-semibold">

                            {item.quantity}{" "}
                            {item.product.unit ||
                              "Adet"}

                          </td>

                          <td className="px-6 py-4 text-right font-bold">

                            {formatPrice(total)} ₺

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

              <div className="flex flex-col gap-5 border-t border-slate-200 p-5 md:flex-row md:items-center md:justify-between md:p-6">

                <div>

                  <p className="text-sm text-slate-500">
                    Genel Toplam
                  </p>

                  <p className="text-3xl font-bold text-slate-900">

                    {formatPrice(
                      calculateTotal()
                    )} ₺

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
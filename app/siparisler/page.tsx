"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  customer_type: string | null;
};

type Product = {
  id: string;
  product_name: string;
  barcode: string | null;
  purchase_price: number | null;
  wholesale_price: number | null;
  retail_price: number | null;
  stock: number | null;
  unit: string | null;
  dealer_price: number | null;
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

/* =========================================================
   CONSTANTS
========================================================= */

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

const STATUS_DOT_CLASSES: Record<string, string> = {
  new: "bg-blue-500",
  preparing: "bg-amber-500",
  shipped: "bg-purple-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
};

const STATUS_STEPS = [
  { key: "new", label: "Yeni" },
  { key: "preparing", label: "Hazırlanıyor" },
  { key: "shipped", label: "Kargoda" },
  { key: "completed", label: "Tamamlandı" },
];

const PAGE_SIZE = 20;
const ACCOUNT_PAGE_SIZE = 1000;

/* =========================================================
   PAGE
========================================================= */

export default function OrdersPage() {
  /* -------------------------------------------------------
     VIEW
  ------------------------------------------------------- */

  const [activeView, setActiveView] =
    useState<"orders" | "new">("orders");

  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);

  /* -------------------------------------------------------
     LIST FILTERS
  ------------------------------------------------------- */

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [sortOrder, setSortOrder] =
    useState<
      "newest" | "oldest" | "highest" | "lowest"
    >("newest");

  const [currentPage, setCurrentPage] = useState(1);

  /* -------------------------------------------------------
     DETAIL
  ------------------------------------------------------- */

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  const [selectedOrderItems, setSelectedOrderItems] =
    useState<OrderItem[]>([]);

  const [detailLoading, setDetailLoading] =
    useState(false);

  /* -------------------------------------------------------
     ACCOUNT
  ------------------------------------------------------- */

  const [accountTransactions, setAccountTransactions] =
    useState<AccountTransaction[]>([]);

  const [accountLoading, setAccountLoading] =
    useState(false);

  const [accountError, setAccountError] =
    useState(false);

  /* -------------------------------------------------------
     ORDER ACTIONS
  ------------------------------------------------------- */

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const [cancellingOrder, setCancellingOrder] =
    useState(false);

  const [invoiceMode, setInvoiceMode] =
    useState(false);

  /* -------------------------------------------------------
     NEW ORDER
  ------------------------------------------------------- */

  const [selectedCustomer, setSelectedCustomer] =
    useState("");

  const [selectedProduct, setSelectedProduct] =
    useState("");

  const [quantity, setQuantity] =
    useState("1");

  const [barcode, setBarcode] =
    useState("");

  const [salePrice, setSalePrice] =
    useState("");

  const [cart, setCart] =
    useState<CartItem[]>([]);

  const [creatingOrder, setCreatingOrder] =
    useState(false);

  /* -------------------------------------------------------
     SCANNER
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     REQUEST RACE PROTECTION
  ------------------------------------------------------- */

  const detailRequestRef =
    useRef(0);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    void loadInitialData();

    return () => {
      void stopScanner();
    };
  }, []);

  async function loadInitialData() {
    setLoading(true);

    try {
      await Promise.all([
        loadCustomers(),
        loadProducts(),
        loadOrders(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, company_name, contact_name, phone, customer_type"
      )
      .order("company_name");

    if (error) {
      console.error(error);
      alert("Müşteriler yüklenemedi.");
      return;
    }

    setCustomers(data ?? []);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(
  "id, product_name, barcode, purchase_price, wholesale_price, retail_price, dealer_price, stock, unit"
)
      .eq("is_active", true)
      .order("product_name");

    if (error) {
      console.error(error);
      alert("Ürünler yüklenemedi.");
      return;
    }

    setProducts(data ?? []);
  }

  async function loadOrders() {
    setOrdersLoading(true);

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_id, status, subtotal, total, notes, created_at"
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(error);
        alert("Siparişler yüklenemedi.");
        return;
      }

      setOrders(data ?? []);
    } finally {
      setOrdersLoading(false);
    }
  }

  /* =========================================================
     FORMAT
  ========================================================= */

  function formatPrice(value: number) {
    return Number(value || 0).toLocaleString(
      "tr-TR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function formatDateShort(value: string) {
    return new Date(value).toLocaleDateString(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  /* =========================================================
     HELPERS
  ========================================================= */

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

  function getStatusDot(status: string) {
    return (
      STATUS_DOT_CLASSES[status] ||
      "bg-slate-400"
    );
  }

  /* =========================================================
     CUSTOMER / PRICE
  ========================================================= */

  function getSelectedCustomerType() {
    const customer = customers.find(
      (item) => item.id === selectedCustomer
    );

    return (
      customer?.customer_type
        ?.toLowerCase()
        .trim() || ""
    );
  }

  function isWholesaleCustomer() {
    const type = getSelectedCustomerType();

    return [
      "toptan",
      "wholesale",
      "wholesaler",
      "bayi",
      "dealer",
    ].includes(type);
  }

  function getSelectedCustomerTypeLabel() {
    const type = getSelectedCustomerType();

    if (
      [
        "toptan",
        "wholesale",
        "wholesaler",
      ].includes(type)
    ) {
      return "Toptan";
    }

    if (
      ["bayi", "dealer"].includes(type)
    ) {
      return "Bayi";
    }

    return "Perakende";
  }

 function getDefaultSalePrice(product: Product) {
  const type = getSelectedCustomerType();

  if (type === "bayi" || type === "dealer") {
    return Number(
      product.dealer_price ??
        product.retail_price ??
        0
    );
  }

  if (
    type === "toptan" ||
    type === "wholesale" ||
    type === "wholesaler"
  ) {
    return Number(
      product.wholesale_price ??
        product.retail_price ??
        0
    );
  }

  return Number(
    product.retail_price ?? 0
  );
}

function getDefaultPriceLabel() {
  const type = getSelectedCustomerType();

  if (type === "bayi" || type === "dealer") {
    return "Bayi Satış Fiyatı";
  }

  if (
    type === "toptan" ||
    type === "wholesale" ||
    type === "wholesaler"
  ) {
    return "Toptan Satış Fiyatı";
  }

  return "Perakende Satış Fiyatı";
}
  /* =========================================================
     ORDER STATS
  ========================================================= */

  const orderStats = useMemo(() => {
    const all = orders.length;

    const newCount = orders.filter(
      (o) => o.status === "new"
    ).length;

    const preparing = orders.filter(
      (o) => o.status === "preparing"
    ).length;

    const shipped = orders.filter(
      (o) => o.status === "shipped"
    ).length;

    const completed = orders.filter(
      (o) => o.status === "completed"
    ).length;

    const cancelled = orders.filter(
      (o) => o.status === "cancelled"
    ).length;

    const active =
      newCount +
      preparing +
      shipped;

    const totalRevenue = orders
      .filter(
        (o) => o.status !== "cancelled"
      )
      .reduce(
        (sum, o) =>
          sum + Number(o.total || 0),
        0
      );

    const completedRevenue = orders
      .filter(
        (o) => o.status === "completed"
      )
      .reduce(
        (sum, o) =>
          sum + Number(o.total || 0),
        0
      );

    return {
      all,
      newCount,
      preparing,
      shipped,
      completed,
      cancelled,
      active,
      totalRevenue,
      completedRevenue,
    };
  }, [orders]);

  /* =========================================================
     FILTERED ORDERS
  ========================================================= */

  const filteredOrders = useMemo(() => {
    const searchText =
      search.trim().toLowerCase();

    let result = orders.filter((order) => {
      const customer = getCustomer(
        order.customer_id
      );

      const matchesSearch =
        !searchText ||
        String(
          order.order_number
        ).includes(searchText) ||
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

      return (
        matchesSearch &&
        matchesStatus
      );
    });

    result = [...result].sort(
      (a, b) => {
        if (sortOrder === "newest") {
          return (
            new Date(
              b.created_at
            ).getTime() -
            new Date(
              a.created_at
            ).getTime()
          );
        }

        if (sortOrder === "oldest") {
          return (
            new Date(
              a.created_at
            ).getTime() -
            new Date(
              b.created_at
            ).getTime()
          );
        }

        if (sortOrder === "highest") {
          return (
            Number(b.total) -
            Number(a.total)
          );
        }

        return (
          Number(a.total) -
          Number(b.total)
        );
      }
    );

    return result;
  }, [
    orders,
    search,
    statusFilter,
    sortOrder,
    customers,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    statusFilter,
    sortOrder,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredOrders.length /
        PAGE_SIZE
    )
  );

  const paginatedOrders =
    filteredOrders.slice(
      (currentPage - 1) *
        PAGE_SIZE,
      currentPage *
        PAGE_SIZE
    );

  /* =========================================================
     ORDER DETAIL
  ========================================================= */

  function getOrderItemCount(
    order: Order
  ) {
    if (
      selectedOrder &&
      selectedOrder.id === order.id
    ) {
      return selectedOrderItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ),
        0
      );
    }

    return null;
  }

  async function loadAllCustomerTransactions(
    customerId: string,
    requestId: number
  ) {
    const allTransactions: AccountTransaction[] =
      [];

    let from = 0;

    while (true) {
      const to =
        from +
        ACCOUNT_PAGE_SIZE -
        1;

      const { data, error } =
        await supabase
          .from("account_transactions")
          .select(
            "id, transaction_type, amount, note, created_at"
          )
          .eq(
            "customer_id",
            customerId
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .range(from, to);

      if (requestId !== detailRequestRef.current) {
        return null;
      }

      if (error) {
        throw error;
      }

      const rows = (data ?? []).map(
        (transaction) => ({
          ...transaction,
          amount: Number(
            transaction.amount ?? 0
          ),
        })
      );

      allTransactions.push(
        ...rows
      );

      if (
        rows.length <
        ACCOUNT_PAGE_SIZE
      ) {
        break;
      }

      from += ACCOUNT_PAGE_SIZE;
    }

    return allTransactions;
  }

  async function openOrder(
    order: Order
  ) {
    const requestId =
      ++detailRequestRef.current;

    setSelectedOrder(order);
    setSelectedOrderItems([]);
    setAccountTransactions([]);
    setAccountError(false);
    setInvoiceMode(false);

    setDetailLoading(true);
    setAccountLoading(true);

    try {
      const [
        itemsResult,
        accountResult,
      ] = await Promise.all([
        supabase
          .from("order_items")
          .select(
            "id, product_id, product_name, barcode, quantity, unit_price, total_price, purchase_price"
          )
          .eq(
            "order_id",
            order.id
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          ),

        loadAllCustomerTransactions(
          order.customer_id,
          requestId
        ),
      ]);

      if (
        requestId !==
        detailRequestRef.current
      ) {
        return;
      }

      if (itemsResult.error) {
        console.error(
          itemsResult.error
        );

        alert(
          "Sipariş detayları yüklenemedi."
        );
      } else {
        setSelectedOrderItems(
          (itemsResult.data ?? []).map(
            (item) => ({
              ...item,
              quantity: Number(
                item.quantity ?? 0
              ),
              unit_price: Number(
                item.unit_price ?? 0
              ),
              total_price: Number(
                item.total_price ?? 0
              ),
              purchase_price:
                Number(
                  item.purchase_price ??
                    0
                ),
            })
          )
        );
      }

      if (
        accountResult === null
      ) {
        return;
      }

      setAccountTransactions(
        accountResult
      );
    } catch (error) {
      if (
        requestId !==
        detailRequestRef.current
      ) {
        return;
      }

      console.error(error);

      setAccountError(true);
    } finally {
      if (
        requestId ===
        detailRequestRef.current
      ) {
        setDetailLoading(false);
        setAccountLoading(false);
      }
    }
  }

  function closeOrder() {
    if (
      updatingStatus ||
      cancellingOrder
    ) {
      return;
    }

    ++detailRequestRef.current;

    setSelectedOrder(null);
    setSelectedOrderItems([]);
    setAccountTransactions([]);
    setAccountError(false);
    setInvoiceMode(false);
  }

  /* =========================================================
     STATUS
  ========================================================= */

  async function updateStatus(
    newStatus: string
  ) {
    if (
      !selectedOrder ||
      updatingStatus ||
      cancellingOrder
    ) {
      return;
    }

    setUpdatingStatus(true);

    try {
      const { error } =
        await supabase.rpc(
          "update_order_status",
          {
            p_order_id:
              selectedOrder.id,
            p_new_status:
              newStatus,
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

      const updatedOrder: Order = {
        ...selectedOrder,
        status: newStatus,
      };

      setSelectedOrder(
        updatedOrder
      );

      setOrders((current) =>
        current.map((order) =>
          order.id ===
          selectedOrder.id
            ? updatedOrder
            : order
        )
      );
    } catch (error) {
      console.error(error);

      alert(
        "Sipariş durumu güncellenirken beklenmeyen bir hata oluştu."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  function getNextStatus(
    status: string
  ) {
    if (status === "new") {
      return "preparing";
    }

    if (
      status === "preparing"
    ) {
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
      (step) =>
        step.key === status
    );
  }

  /* =========================================================
     CANCEL
  ========================================================= */

  async function cancelOrder() {
    if (
      !selectedOrder ||
      cancellingOrder ||
      updatingStatus
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `#${selectedOrder.order_number} numaralı siparişi iptal etmek istediğine emin misin?\n\nStoklar geri eklenecek ve müşteri cari kaydı geri alınacaktır.\n\nBu işlem geri alınamaz.`
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
            p_order_id:
              selectedOrder.id,
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

      const result =
        Array.isArray(data)
          ? data[0]
          : null;

      const updatedOrder: Order = {
        ...selectedOrder,
        status: "cancelled",
      };

      setOrders((current) =>
        current.map((order) =>
          order.id ===
          selectedOrder.id
            ? updatedOrder
            : order
        )
      );

      setSelectedOrder(
        updatedOrder
      );

      await Promise.all([
        loadProducts(),
        loadOrders(),
      ]);

      await openOrder(
        updatedOrder
      );

      alert(
        `Sipariş #${selectedOrder.order_number} iptal edildi.\n\n${
          Number(
            result?.result_restored_items ??
              0
          )
        } ürün kalemi stoklara geri eklendi.`
      );
    } catch (error) {
      console.error(error);

      alert(
        "Sipariş iptal edilirken beklenmeyen bir hata oluştu."
      );
    } finally {
      setCancellingOrder(false);
    }
  }

  /* =========================================================
     NEW ORDER
  ========================================================= */

  function startNewOrder() {
    void stopScanner();

    setSelectedCustomer("");
    setSelectedProduct("");
    setQuantity("1");
    setBarcode("");
    setSalePrice("");
    setCart([]);

    setActiveView("new");

    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 150);
  }

  function backToOrders() {
    void stopScanner();

    setActiveView("orders");

    setSelectedCustomer("");
    setSelectedProduct("");
    setQuantity("1");
    setBarcode("");
    setSalePrice("");
    setCart([]);

    void loadOrders();
    void loadProducts();
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

  /* =========================================================
     BARCODE
  ========================================================= */

  function findProductByBarcode(
    code: string
  ) {
    const cleanBarcode =
      code.trim();

    if (!cleanBarcode) {
      alert("Barkod gir.");
      return null;
    }

    const product =
      products.find(
        (item) =>
          item.barcode?.trim() ===
          cleanBarcode
      );

    if (!product) {
      alert(
        `Bu barkoda ait ürün bulunamadı.\n\nBarkod: ${cleanBarcode}`
      );

      return null;
    }

    return product;
  }

  function prepareProduct(
    product: Product
  ) {
    setSelectedProduct(
      product.id
    );

    const existing =
      cart.find(
        (item) =>
          item.product.id ===
          product.id
      );

    if (existing) {
      setQuantity(
        String(
          existing.quantity
        )
      );

      setSalePrice(
        String(
          existing.unitPrice
        )
      );
    } else {
      setQuantity("1");

      setSalePrice(
        String(
          getDefaultSalePrice(
            product
          )
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
      findProductByBarcode(
        barcode
      );

    if (!product) {
      return;
    }

    prepareProduct(product);
  }

  /* =========================================================
     SCANNER
  ========================================================= */

  async function startScanner() {
    if (!selectedCustomer) {
      alert("Önce müşteri seç.");
      return;
    }

    if (
      scannerStartedRef.current ||
      scannerLoading
    ) {
      return;
    }

    setScannerLoading(true);
    setScannerOpen(true);

    try {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            150
          )
      );

      if (
        !document.getElementById(
          "barcode-reader"
        )
      ) {
        throw new Error(
          "Barkod okuyucu alanı bulunamadı."
        );
      }

      const scanner =
        new Html5Qrcode(
          "barcode-reader"
        );

      scannerRef.current =
        scanner;

      /*
       * start() tamamlanmadan callback
       * çalışırsa bile stopScanner()
       * tarafından güvenli şekilde
       * yönetilebilmesi için flag'i
       * burada açıyoruz.
       */
      scannerStartedRef.current =
        true;

      await scanner.start(
        {
          facingMode:
            "environment",
        },
        {
          fps: 10,
          qrbox: {
            width: 280,
            height: 120,
          },
          aspectRatio: 1.777778,
        },
        async (
          decodedText
        ) => {
          const cleanBarcode =
            decodedText.trim();

          if (
            !cleanBarcode
          ) {
            return;
          }

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

          setBarcode(
            cleanBarcode
          );

          prepareProduct(
            product
          );

          await stopScanner();

          focusPrice();
        },
        () => {}
      );
    } catch (error) {
      console.error(error);

      scannerStartedRef.current =
        false;

      scannerRef.current =
        null;

      setScannerOpen(false);

      alert(
        "Kamera açılamadı.\n\nKamera iznini kontrol et ve sayfanın HTTPS üzerinden açıldığından emin ol."
      );
    } finally {
      setScannerLoading(false);
    }
  }

  async function stopScanner() {
    const scanner =
      scannerRef.current;

    scannerRef.current = null;

    const wasStarted =
      scannerStartedRef.current;

    scannerStartedRef.current =
      false;

    if (scanner && wasStarted) {
      try {
        await scanner.stop();
      } catch (error) {
        console.error(
          "Scanner stop error:",
          error
        );
      }

      try {
        scanner.clear();
      } catch (error) {
        console.error(
          "Scanner clear error:",
          error
        );
      }
    }

    setScannerOpen(false);
    setScannerLoading(false);
  }

  /* =========================================================
     CART
  ========================================================= */

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

    const product =
      products.find(
        (item) =>
          item.id ===
          selectedProduct
      );

    if (!product) {
      alert(
        "Seçilen ürün bulunamadı."
      );
      return;
    }

    const qty =
      Number(quantity);

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      alert(
        "Geçerli bir miktar gir."
      );

      focusQuantity();
      return;
    }

    const price =
      Number(salePrice);

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

    const stock =
      Number(
        product.stock ?? 0
      );

    const existing =
      cart.find(
        (item) =>
          item.product.id ===
          product.id
      );

    if (existing) {
      const newQuantity =
        existing.quantity +
        qty;

      if (
        newQuantity >
        stock
      ) {
        alert(
          `Yetersiz stok.\n\nMevcut stok: ${stock}\nSepette: ${existing.quantity}\nEklemek istediğin: ${qty}`
        );

        focusQuantity();
        return;
      }

      setCart((current) =>
        current.map(
          (item) =>
            item.product.id ===
            product.id
              ? {
                  ...item,
                  quantity:
                    newQuantity,
                  unitPrice:
                    price,
                }
              : item
        )
      );
    } else {
      if (qty > stock) {
        alert(
          `Yetersiz stok.\n\nMevcut stok: ${stock}`
        );

        focusQuantity();
        return;
      }

      setCart((current) => [
        ...current,
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

  function removeFromCart(
    productId: string
  ) {
    setCart((current) =>
      current.filter(
        (item) =>
          item.product.id !==
          productId
      )
    );

    focusBarcode();
  }

  function calculateTotal() {
    return cart.reduce(
      (total, item) =>
        total +
        item.unitPrice *
          item.quantity,
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
      (item) =>
        item.id ===
        selectedProduct
    );
  }

  /* =========================================================
     KEYBOARD
  ========================================================= */

  function handleBarcodeKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBarcodeSearch();
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

  function handleQuantityKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      addToCart();
    }
  }

  /* =========================================================
     CREATE ORDER
  ========================================================= */

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
       * Sepet zaten ürün ID'sine göre
       * birleştiriliyor. Yine de RPC'ye
       * göndermeden önce güvenli bir
       * map oluşturuyoruz.
       */
      const items = cart.map(
        (item) => ({
          product_id:
            item.product.id,
          quantity:
            Number(
              item.quantity
            ),
          unit_price:
            Number(
              item.unitPrice
            ),
        })
      );

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
            "Sipariş oluşturulurken hata oluştu."
        );

        return;
      }

      if (
        !data ||
        data.length === 0
      ) {
        alert(
          "Sipariş oluşturuldu ancak sipariş bilgisi alınamadı."
        );

        return;
      }

      const order = data[0];

      alert(
        `Sipariş başarıyla oluşturuldu!\n\nSipariş No: #${order.result_order_number}\nToplam: ${formatPrice(
          Number(
            order.result_total ?? 0
          )
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

      setActiveView(
        "orders"
      );
    } catch (error) {
      console.error(error);

      alert(
        "Sipariş oluşturulurken beklenmeyen bir hata oluştu."
      );
    } finally {
      setCreatingOrder(false);
    }
  }

  /* =========================================================
     ACCOUNT
  ========================================================= */

  function getSelectedOrderTotalQuantity() {
    return selectedOrderItems.reduce(
      (total, item) =>
        total +
        Number(
          item.quantity || 0
        ),
      0
    );
  }

  function getSelectedOrderProfit() {
    return selectedOrderItems.reduce(
      (total, item) =>
        total +
        (
          Number(
            item.unit_price ?? 0
          ) -
          Number(
            item.purchase_price ?? 0
          )
        ) *
          Number(
            item.quantity ?? 0
          ),
      0
    );
  }

  function getCustomerAccountBalance() {
    let balance = 0;

    for (
      const transaction of
        accountTransactions
    ) {
      const amount =
        Number(
          transaction.amount || 0
        );

      /*
       * Müşterinin borcunu artıranlar:
       * sale
       * customer_refund
       *
       * Müşterinin borcunu azaltanlar:
       * payment
       * collection
       * refund
       */
      if (
        [
          "sale",
          "customer_refund",
        ].includes(
          transaction.transaction_type
        )
      ) {
        balance += amount;
      }

      if (
        [
          "refund",
          "payment",
          "collection",
        ].includes(
          transaction.transaction_type
        )
      ) {
        balance -= amount;
      }
    }

    return balance;
  }

  function getAccountTransactionLabel(
    type: string
  ) {
    const labels: Record<
      string,
      string
    > = {
      sale: "Satış",
      refund: "İade",
      payment: "Ödeme",
      collection: "Tahsilat",
      customer_refund:
        "Müşteri İadesi",
    };

    return (
      labels[type] ||
      type
    );
  }

  /* =========================================================
     PRINT
  ========================================================= */

  function printOrder() {
    if (
      !selectedOrder ||
      selectedOrderItems.length ===
        0
    ) {
      return;
    }

    setInvoiceMode(true);

    setTimeout(() => {
      window.print();
    }, 150);
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-slate-200" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({
              length: 4,
            }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const selectedProductData =
    getSelectedProduct();

  /* =========================================================
     ORDERS VIEW
  ========================================================= */

  if (
    activeView ===
    "orders"
  ) {
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
            {/* HEADER */}

            <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-xl text-white shadow-sm">
                    📦
                  </div>

                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                      Siparişler
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                      Tüm siparişlerini tek ekrandan yönet.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={
                  startNewOrder
                }
                className="rounded-xl bg-slate-900 px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                + Yeni Sipariş
              </button>
            </div>

            {/* KPI */}

            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Toplam Ciro
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatPrice(
                        orderStats.totalRevenue
                      )}{" "}
                      ₺
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      İptal edilenler hariç
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-100 p-3">
                    💰
                  </div>
                </div>
              </div>

              <button
                onClick={() =>
                  setStatusFilter(
                    "all"
                  )
                }
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Toplam Sipariş
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {orderStats.all}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Sistemdeki tüm siparişler
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-100 p-3">
                    📋
                  </div>
                </div>
              </button>

              <button
                onClick={() =>
                  setStatusFilter(
                    "new"
                  )
                }
                className="rounded-2xl border border-blue-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-500">
                      Aktif Sipariş
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {orderStats.active}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      İşlem bekleyen
                    </p>
                  </div>

                  <div className="rounded-xl bg-blue-50 p-3">
                    ⚡
                  </div>
                </div>
              </button>

              <button
                onClick={() =>
                  setStatusFilter(
                    "completed"
                  )
                }
                className="rounded-2xl border border-emerald-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      Tamamlanan
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {orderStats.completed}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {formatPrice(
                        orderStats.completedRevenue
                      )}{" "}
                      ₺ tamamlanan ciro
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-3">
                    ✓
                  </div>
                </div>
              </button>
            </div>

            {/* STATUS QUICK FILTERS */}

            <div className="mb-6 overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {[
                  {
                    key: "all",
                    label: "Tümü",
                    count:
                      orderStats.all,
                  },
                  {
                    key: "new",
                    label: "Yeni",
                    count:
                      orderStats.newCount,
                  },
                  {
                    key: "preparing",
                    label:
                      "Hazırlanıyor",
                    count:
                      orderStats.preparing,
                  },
                  {
                    key: "shipped",
                    label:
                      "Kargoda",
                    count:
                      orderStats.shipped,
                  },
                  {
                    key: "completed",
                    label:
                      "Tamamlandı",
                    count:
                      orderStats.completed,
                  },
                  {
                    key: "cancelled",
                    label: "İptal",
                    count:
                      orderStats.cancelled,
                  },
                ].map(
                  (item) => (
                    <button
                      key={
                        item.key
                      }
                      onClick={() =>
                        setStatusFilter(
                          item.key
                        )
                      }
                      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                        statusFilter ===
                        item.key
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}

                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                          statusFilter ===
                          item.key
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {
                          item.count
                        }
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* SEARCH */}

            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[1fr_210px_210px]">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    🔎
                  </span>

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target
                          .value
                      )
                    }
                    placeholder="Sipariş no, müşteri, kişi veya telefon ara..."
                    className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-10 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  />

                  {search && (
                    <button
                      onClick={() =>
                        setSearch(
                          ""
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={
                    sortOrder
                  }
                  onChange={(e) =>
                    setSortOrder(
                      e.target
                        .value as typeof sortOrder
                    )
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                >
                  <option value="newest">
                    En Yeni
                  </option>

                  <option value="oldest">
                    En Eski
                  </option>

                  <option value="highest">
                    En Yüksek Tutar
                  </option>

                  <option value="lowest">
                    En Düşük Tutar
                  </option>
                </select>

                <select
                  value={
                    statusFilter
                  }
                  onChange={(e) =>
                    setStatusFilter(
                      e.target
                        .value
                    )
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                >
                  <option value="all">
                    Tüm Durumlar
                  </option>

                  <option value="new">
                    Yeni (
                    {
                      orderStats.newCount
                    }
                    )
                  </option>

                  <option value="preparing">
                    Hazırlanıyor (
                    {
                      orderStats.preparing
                    }
                    )
                  </option>

                  <option value="shipped">
                    Kargoda (
                    {
                      orderStats.shipped
                    }
                    )
                  </option>

                  <option value="completed">
                    Tamamlandı (
                    {
                      orderStats.completed
                    }
                    )
                  </option>

                  <option value="cancelled">
                    İptal (
                    {
                      orderStats.cancelled
                    }
                    )
                  </option>
                </select>
              </div>

              <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <strong className="text-slate-800">
                    {
                      filteredOrders.length
                    }
                  </strong>{" "}
                  sipariş bulundu
                </p>

                {(search ||
                  statusFilter !==
                    "all" ||
                  sortOrder !==
                    "newest") && (
                  <button
                    onClick={() => {
                      setSearch(
                        ""
                      );

                      setStatusFilter(
                        "all"
                      );

                      setSortOrder(
                        "newest"
                      );
                    }}
                    className="font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Filtreleri temizle
                  </button>
                )}
              </div>
            </div>

            {/* TABLE */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {ordersLoading ? (
                <div className="p-16 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

                  <p className="mt-4 text-sm text-slate-500">
                    Siparişler yükleniyor...
                  </p>
                </div>
              ) : filteredOrders.length ===
                0 ? (
                <div className="p-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                    📦
                  </div>

                  <h3 className="mt-5 font-bold text-slate-800">
                    Sipariş bulunamadı
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Arama veya filtre kriterlerini değiştir.
                  </p>
                </div>
              ) : (
                <>
                  {/* DESKTOP */}

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Sipariş
                          </th>

                          <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Müşteri
                          </th>

                          <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Tarih
                          </th>

                          <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Durum
                          </th>

                          <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Toplam
                          </th>

                          <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            İşlem
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {paginatedOrders.map(
                          (order) => {
                            const customer =
                              getCustomer(
                                order.customer_id
                              );

                            const itemCount =
                              getOrderItemCount(
                                order
                              );

                            return (
                              <tr
                                key={
                                  order.id
                                }
                                className="group transition hover:bg-slate-50"
                              >
                                <td className="px-5 py-4">
                                  <p className="font-bold text-slate-900">
                                    #
                                    {
                                      order.order_number
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-slate-400">
                                    {itemCount !==
                                    null
                                      ? `${itemCount} adet`
                                      : "Detay için aç"}
                                  </p>
                                </td>

                                <td className="px-5 py-4">
                                  <p className="max-w-[260px] truncate font-semibold text-slate-900">
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
                                  <p className="text-sm font-medium text-slate-700">
                                    {formatDateShort(
                                      order.created_at
                                    )}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-400">
                                    {new Date(
                                      order.created_at
                                    ).toLocaleTimeString(
                                      "tr-TR",
                                      {
                                        hour: "2-digit",
                                        minute:
                                          "2-digit",
                                      }
                                    )}
                                  </p>
                                </td>

                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClass(
                                      order.status
                                    )}`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${getStatusDot(
                                        order.status
                                      )}`}
                                    />

                                    {getStatusLabel(
                                      order.status
                                    )}
                                  </span>
                                </td>

                                <td className="px-5 py-4 text-right">
                                  <p className="font-bold text-slate-900">
                                    {formatPrice(
                                      Number(
                                        order.total ??
                                          0
                                      )
                                    )}{" "}
                                    ₺
                                  </p>
                                </td>

                                <td className="px-5 py-4 text-right">
                                  <button
                                    onClick={() =>
                                      void openOrder(
                                        order
                                      )
                                    }
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 opacity-80 transition hover:border-slate-300 hover:bg-white hover:opacity-100"
                                  >
                                    Detay →
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE */}

                  <div className="divide-y divide-slate-100 md:hidden">
                    {paginatedOrders.map(
                      (order) => {
                        const customer =
                          getCustomer(
                            order.customer_id
                          );

                        return (
                          <button
                            key={
                              order.id
                            }
                            onClick={() =>
                              void openOrder(
                                order
                              )
                            }
                            className="w-full p-4 text-left transition active:bg-slate-100"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-900">
                                    #
                                    {
                                      order.order_number
                                    }
                                  </p>

                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClass(
                                      order.status
                                    )}`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${getStatusDot(
                                        order.status
                                      )}`}
                                    />

                                    {getStatusLabel(
                                      order.status
                                    )}
                                  </span>
                                </div>

                                <p className="mt-2 truncate font-semibold text-slate-700">
                                  {customer?.company_name ||
                                    "Bilinmeyen müşteri"}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {formatDateShort(
                                    order.created_at
                                  )}
                                </p>
                              </div>

                              <p className="shrink-0 font-bold text-slate-900">
                                {formatPrice(
                                  Number(
                                    order.total ??
                                      0
                                  )
                                )}{" "}
                                ₺
                              </p>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                              <span>
                                Sipariş detayını görüntüle
                              </span>

                              <span className="font-bold text-slate-600">
                                →
                              </span>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </>
              )}
            </div>

            {/* PAGINATION */}

            {filteredOrders.length >
              PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-slate-500">
                  Sayfa{" "}
                  <strong className="text-slate-900">
                    {
                      currentPage
                    }
                  </strong>{" "}
                  /{" "}
                  {
                    totalPages
                  }
                </p>

                <div className="flex gap-2">
                  <button
                    disabled={
                      currentPage ===
                      1
                    }
                    onClick={() =>
                      setCurrentPage(
                        (p) =>
                          Math.max(
                            1,
                            p - 1
                          )
                      )
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ←
                  </button>

                  <button
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    onClick={() =>
                      setCurrentPage(
                        (p) =>
                          Math.min(
                            totalPages,
                            p + 1
                          )
                      )
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* =================================================
              ORDER DETAIL MODAL
          ================================================= */}

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
              <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                {/* HEADER */}

                <div className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-4 md:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                            selectedOrder.status
                          )}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${getStatusDot(
                              selectedOrder.status
                            )}`}
                          />

                          {getStatusLabel(
                            selectedOrder.status
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={
                          printOrder
                        }
                        disabled={
                          detailLoading ||
                          selectedOrderItems.length ===
                            0
                        }
                        className="hidden rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:block"
                      >
                        🖨 Yazdır
                      </button>

                      <button
                        onClick={
                          closeOrder
                        }
                        disabled={
                          updatingStatus ||
                          cancellingOrder
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={
                      printOrder
                    }
                    disabled={
                      detailLoading ||
                      selectedOrderItems.length ===
                        0
                    }
                    className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 sm:hidden"
                  >
                    🖨 Yazdır / PDF
                  </button>
                </div>

                <div className="space-y-6 p-4 md:p-6">
                  {/* CUSTOMER */}

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:col-span-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Müşteri
                      </p>

                      <p className="mt-2 text-xl font-bold text-slate-900">
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
                            )
                              ?.contact_name
                          }
                        </p>
                      )}

                      {getCustomer(
                        selectedOrder.customer_id
                      )?.phone && (
                        <p className="mt-3 text-sm font-medium text-slate-500">
                          📞{" "}
                          {
                            getCustomer(
                              selectedOrder.customer_id
                            )
                              ?.phone
                          }
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Sipariş Tarihi
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {formatDate(
                          selectedOrder.created_at
                        )}
                      </p>
                    </div>
                  </div>

                  {/* STATUS */}

                  <div className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Sipariş Durumu
                        </h3>

                        <p className="mt-1 text-xs text-slate-400">
                          Siparişin mevcut aşaması
                        </p>
                      </div>
                    </div>

                    {selectedOrder.status ===
                    "cancelled" ? (
                      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="font-bold text-red-700">
                          ❌ Sipariş iptal edildi.
                        </p>

                        <p className="mt-1 text-sm text-red-600">
                          Stok ve cari kayıtları geri alınmıştır.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-6 flex items-center">
                          {STATUS_STEPS.map(
                            (
                              step,
                              index
                            ) => {
                              const currentIndex =
                                getCurrentStatusIndex(
                                  selectedOrder.status
                                );

                              const completed =
                                index <=
                                currentIndex;

                              return (
                                <div
                                  key={
                                    step.key
                                  }
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
                                        : index +
                                          1}
                                    </div>

                                    <p
                                      className={`mt-2 text-center text-[10px] font-semibold sm:text-xs ${
                                        completed
                                          ? "text-slate-900"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {
                                        step.label
                                      }
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

                        <div className="mt-6 flex flex-wrap gap-2">
                          {getNextStatus(
                            selectedOrder.status
                          ) && (
                            <button
                              onClick={() =>
                                void updateStatus(
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
                        </div>
                      </>
                    )}
                  </div>

                  {/* SUMMARY */}

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Farklı Ürün
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {
                          selectedOrderItems.length
                        }
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Toplam Adet
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {getSelectedOrderTotalQuantity()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Sipariş Toplamı
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {formatPrice(
                          Number(
                            selectedOrder.total ??
                              0
                          )
                        )}{" "}
                        ₺
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                        Tahmini Kâr
                      </p>

                      <p
                        className={`mt-2 text-2xl font-bold ${
                          getSelectedOrderProfit() >=
                          0
                            ? "text-emerald-700"
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

                  {/* PRODUCTS */}

                  <div>
                    <div className="mb-3 flex items-end justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          Sipariş Ürünleri
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          Siparişte bulunan ürünler
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
                      <div className="rounded-xl bg-slate-50 p-10 text-center text-sm text-slate-500">
                        Ürünler yükleniyor...
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  Ürün
                                </th>

                                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  Miktar
                                </th>

                                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  Birim
                                </th>

                                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  Toplam
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                              {selectedOrderItems.length ===
                              0 ? (
                                <tr>
                                  <td
                                    colSpan={
                                      4
                                    }
                                    className="px-4 py-10 text-center text-sm text-slate-400"
                                  >
                                    Siparişte ürün bulunamadı.
                                  </td>
                                </tr>
                              ) : (
                                selectedOrderItems.map(
                                  (
                                    item
                                  ) => (
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
                                            item.unit_price ??
                                              0
                                          )
                                        )}{" "}
                                        ₺
                                      </td>

                                      <td className="px-4 py-4 text-right font-bold text-slate-900">
                                        {formatPrice(
                                          Number(
                                            item.total_price ??
                                              0
                                          )
                                        )}{" "}
                                        ₺
                                      </td>
                                    </tr>
                                  )
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACCOUNT */}

                  <div className="rounded-2xl border border-slate-200">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Müşteri Cari
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          Son cari hareketleri
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

                    {accountLoading ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        Cari yükleniyor...
                      </div>
                    ) : accountError ? (
                      <div className="p-8 text-center text-sm text-red-500">
                        Cari hareketleri yüklenemedi.
                      </div>
                    ) : accountTransactions.length ===
                      0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        Cari hareket bulunmuyor.
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto">
                        {accountTransactions
                          .slice(
                            0,
                            10
                          )
                          .map(
                            (
                              transaction
                            ) => {
                              const isDebit =
                                [
                                  "sale",
                                  "customer_refund",
                                ].includes(
                                  transaction.transaction_type
                                );

                              const isCredit =
                                [
                                  "refund",
                                  "payment",
                                  "collection",
                                ].includes(
                                  transaction.transaction_type
                                );

                              return (
                                <div
                                  key={
                                    transaction.id
                                  }
                                  className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-0"
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
                                        : isCredit
                                        ? "text-emerald-600"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    {isDebit
                                      ? "+"
                                      : isCredit
                                      ? "-"
                                      : ""}
                                    {formatPrice(
                                      Number(
                                        transaction.amount ??
                                          0
                                      )
                                    )}{" "}
                                    ₺
                                  </p>
                                </div>
                              );
                            }
                          )}
                      </div>
                    )}
                  </div>

                  {/* TOTAL */}

                  <div className="flex justify-end">
                    <div className="w-full rounded-2xl bg-slate-50 p-5 sm:w-96">
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>
                          Ara toplam
                        </span>

                        <span>
                          {formatPrice(
                            Number(
                              selectedOrder.subtotal ??
                                0
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
                              selectedOrder.total ??
                                0
                            )
                          )}{" "}
                          ₺
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRINT */}

          {selectedOrder &&
            selectedOrderItems.length >
              0 && (
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

                      <p className="text-2xl font-bold">
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

                      <p className="font-bold">
                        {getCustomer(
                          selectedOrder.customer_id
                        )?.company_name ||
                          "Bilinmeyen müşteri"}
                      </p>

                      {getCustomer(
                        selectedOrder.customer_id
                      )?.contact_name && (
                        <p className="mt-1 text-sm">
                          {
                            getCustomer(
                              selectedOrder.customer_id
                            )
                              ?.contact_name
                          }
                        </p>
                      )}

                      {getCustomer(
                        selectedOrder.customer_id
                      )?.phone && (
                        <p className="mt-1 text-sm">
                          {
                            getCustomer(
                              selectedOrder.customer_id
                            )
                              ?.phone
                          }
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Durum
                      </p>

                      <p className="font-bold">
                        {getStatusLabel(
                          selectedOrder.status
                        )}
                      </p>
                    </div>
                  </div>

                  <table className="mb-8 w-full border-collapse">
                    <thead>
                      <tr className="border-y-2 border-slate-900">
                        <th className="py-3 text-left text-sm">
                          Ürün
                        </th>

                        <th className="py-3 text-right text-sm">
                          Miktar
                        </th>

                        <th className="py-3 text-right text-sm">
                          Birim
                        </th>

                        <th className="py-3 text-right text-sm">
                          Toplam
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedOrderItems.map(
                        (item) => (
                          <tr
                            key={
                              item.id
                            }
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
                                  item.unit_price ??
                                    0
                                )
                              )}{" "}
                              ₺
                            </td>

                            <td className="py-3 text-right text-sm font-bold">
                              {formatPrice(
                                Number(
                                  item.total_price ??
                                    0
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
                            selectedOrder.subtotal ??
                              0
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
                            selectedOrder.total ??
                              0
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

  /* =========================================================
     NEW ORDER VIEW
  ========================================================= */

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-xl text-white">
                +
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Yeni Sipariş
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Hızlı ve güvenli şekilde sipariş oluştur.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={
              backToOrders
            }
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ← Siparişlere Dön
          </button>
        </div>

        {/* CUSTOMER */}

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
              1
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                Müşteri
              </h2>

              <p className="text-sm text-slate-400">
                Sipariş verecek müşteriyi seç.
              </p>
            </div>
          </div>

          <select
            value={
              selectedCustomer
            }
            onChange={(e) => {
              const newCustomerId =
                e.target.value;

              if (
                cart.length >
                  0 &&
                newCustomerId !==
                  selectedCustomer
              ) {
                const confirmed =
                  window.confirm(
                    "Müşteriyi değiştirirsen mevcut sepet temizlenecek.\n\nDevam etmek istiyor musun?"
                  );

                if (!confirmed) {
                  return;
                }

                setCart([]);
              }

              setSelectedCustomer(
                newCustomerId
              );

              setSelectedProduct("");
              setBarcode("");
              setQuantity("1");
              setSalePrice("");

              if (
                newCustomerId
              ) {
                focusBarcode();
              }
            }}
            className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          >
            <option value="">
              Müşteri seç...
            </option>

            {customers.map(
              (customer) => (
                <option
                  key={
                    customer.id
                  }
                  value={
                    customer.id
                  }
                >
                  {
                    customer.company_name
                  }

                  {customer.contact_name
                    ? ` - ${customer.contact_name}`
                    : ""}
                </option>
              )
            )}
          </select>

          {selectedCustomer && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-500">
                Müşteri tipi
              </span>

              <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-800 shadow-sm">
                {getSelectedCustomerTypeLabel()}
              </span>
            </div>
          )}
        </div>

        {/* PRODUCT */}

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
              2
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                Ürün Ekle
              </h2>

              <p className="text-sm text-slate-400">
                Barkod okut, ürünü seç ve sepete ekle.
              </p>
            </div>
          </div>

          {/* BARCODE */}

          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Barkod
          </label>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              ref={
                barcodeInputRef
              }
              value={barcode}
              onChange={(e) =>
                setBarcode(
                  e.target
                    .value
                )
              }
              onKeyDown={
                handleBarcodeKeyDown
              }
              inputMode="numeric"
              placeholder="Barkodu okut veya yaz..."
              className="rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />

            <button
              onClick={
                handleBarcodeSearch
              }
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Barkodu Bul
            </button>

            {!scannerOpen ? (
              <button
                onClick={() =>
                  void startScanner()
                }
                disabled={
                  scannerLoading
                }
                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {scannerLoading
                  ? "Açılıyor..."
                  : "📷 Kamera"}
              </button>
            ) : (
              <button
                onClick={() =>
                  void stopScanner()
                }
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
              >
                Kamerayı Kapat
              </button>
            )}
          </div>

          {/* SCANNER */}

          {scannerOpen && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
              <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">
                Barkodu kameranın ortasına getir
              </div>

              <div
                id="barcode-reader"
                className="mx-auto w-full max-w-xl"
              />
            </div>
          )}

          {/* PRODUCT FORM */}

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_150px_auto]">
            <select
              value={
                selectedProduct
              }
              onChange={(e) => {
                const product =
                  products.find(
                    (item) =>
                      item.id ===
                      e.target
                        .value
                  );

                if (!product) {
                  setSelectedProduct(
                    ""
                  );

                  setBarcode("");
                  setSalePrice("");

                  return;
                }

                setBarcode(
                  product.barcode ||
                    ""
                );

                prepareProduct(
                  product
                );
              }}
              className="rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-slate-400"
            >
              <option value="">
                Ürün seç...
              </option>

              {products.map(
                (product) => (
                  <option
                    key={
                      product.id
                    }
                    value={
                      product.id
                    }
                  >
                    {
                      product.product_name
                    }
                    {" | Stok: "}
                    {
                      product.stock ??
                      0
                    }
                  </option>
                )
              )}
            </select>

            <input
              ref={
                priceInputRef
              }
              type="number"
              min="0"
              step="0.01"
              value={
                salePrice
              }
              onChange={(e) =>
                setSalePrice(
                  e.target
                    .value
                )
              }
              onKeyDown={
                handlePriceKeyDown
              }
              placeholder="Satış fiyatı"
              className="rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-slate-400"
            />

            <input
              ref={
                quantityInputRef
              }
              type="number"
              min="1"
              step="1"
              value={
                quantity
              }
              onChange={(e) =>
                setQuantity(
                  e.target
                    .value
                )
              }
              onKeyDown={
                handleQuantityKeyDown
              }
              placeholder="Miktar"
              className="rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-slate-400"
            />

            <button
              onClick={
                addToCart
              }
              className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              + Sepete Ekle
            </button>
          </div>

          {/* SELECTED PRODUCT */}

          {selectedProductData && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Seçilen Ürün
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {
                      selectedProductData.product_name
                    }
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Barkod:{" "}
                    {
                      selectedProductData.barcode ||
                      "-"
                    }
                    {" • "}
                    Stok:{" "}
                    {
                      selectedProductData.stock ??
                      0
                    }{" "}
                    {
                      selectedProductData.unit ||
                      "Adet"
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-white px-4 py-3 text-left shadow-sm md:text-right">
                  <p className="text-xs text-slate-400">
                    {
                      getDefaultPriceLabel()
                    }
                  </p>

                  <p className="text-xl font-bold text-slate-900">
                    {formatPrice(
                      getDefaultSalePrice(
                        selectedProductData
                      )
                    )}{" "}
                    ₺
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CART */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                  3
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Sipariş Sepeti
                  </h2>

                  <p className="text-sm text-slate-400">
                    Ürünleri kontrol et ve siparişi oluştur.
                  </p>
                </div>
              </div>

              {cart.length >
                0 && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {
                    cart.length
                  }{" "}
                  ürün
                </span>
              )}
            </div>
          </div>

          {cart.length ===
          0 ? (
            <div className="p-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                🛒
              </div>

              <p className="mt-4 font-semibold text-slate-700">
                Sepet boş
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Barkod okut veya yukarıdan ürün seçerek başla.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                        Ürün
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                        Liste
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                        Satış
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                        Adet
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                        Toplam
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                        İşlem
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {cart.map(
                      (item) => {
                        const total =
                          item.unitPrice *
                          item.quantity;

                        const retailPrice =
                          Number(
                            item.product
                              .retail_price ??
                              0
                          );

                        const discounted =
                          item.unitPrice <
                          retailPrice;

                        return (
                          <tr
                            key={
                              item.product.id
                            }
                            className="hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <p className="font-semibold text-slate-900">
                                {
                                  item.product
                                    .product_name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                Barkod:{" "}
                                {
                                  item.product
                                    .barcode ||
                                  "-"
                                }
                              </p>
                            </td>

                            <td className="px-5 py-4 text-right text-sm text-slate-400">
                              {formatPrice(
                                retailPrice
                              )}{" "}
                              ₺
                            </td>

                            <td className="px-5 py-4 text-right">
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

                            <td className="px-5 py-4 text-right font-semibold text-slate-700">
                              {
                                item.quantity
                              }{" "}
                              {
                                item.product
                                  .unit ||
                                "Adet"
                              }
                            </td>

                            <td className="px-5 py-4 text-right font-bold text-slate-900">
                              {formatPrice(
                                total
                              )}{" "}
                              ₺
                            </td>

                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() =>
                                  removeFromCart(
                                    item.product
                                      .id
                                  )
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                              >
                                Sil
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* CART TOTAL */}

              <div className="border-t border-slate-200 p-5 md:p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">
                      Sipariş Özeti
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                      <span>
                        {
                          cart.length
                        }{" "}
                        farklı ürün
                      </span>

                      <span>
                        •
                      </span>

                      <span>
                        {
                          calculateTotalQuantity()
                        }{" "}
                        toplam adet
                      </span>
                    </div>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-sm text-slate-400">
                      Genel Toplam
                    </p>

                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {formatPrice(
                        calculateTotal()
                      )}{" "}
                      ₺
                    </p>
                  </div>
                </div>

                <button
                  onClick={
                    createOrder
                  }
                  disabled={
                    creatingOrder
                  }
                  className="mt-5 w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingOrder
                    ? "Sipariş Oluşturuluyor..."
                    : "Siparişi Oluştur →"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
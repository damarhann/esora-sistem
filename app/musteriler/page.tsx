"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  postal_code: string | null;
  tax_number: string | null;
  tax_office: string | null;
  email: string | null;
  payment_method: string | null;
  payment_term: number | null;
  credit_limit: number | null;
  notes: string | null;
  customer_type: string | null;
  is_active: boolean;
  created_at: string;
};

type CustomerForm = {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  address: string;
  postalCode: string;
  taxNumber: string;
  taxOffice: string;
  paymentMethod: string;
  paymentTerm: string;
  creditLimit: string;
  notes: string;
  customerType: string;
};

const CUSTOMER_TYPES = [
  "Nalbur",
  "Yapı Market",
  "Tesisatçı",
  "Banyo & Mutfak",
  "Toptancı",
  "Bayi",
  "Diğer",
];

const PAYMENT_METHODS = [
  {
    value: "",
    label: "Seçiniz",
  },
  {
    value: "Peşin",
    label: "Peşin",
  },
  {
    value: "Havale / EFT",
    label: "Havale / EFT",
  },
  {
    value: "Kredi Kartı",
    label: "Kredi Kartı",
  },
  {
    value: "Çek",
    label: "Çek",
  },
  {
    value: "Vadeli",
    label: "Vadeli",
  },
];

function createEmptyForm(): CustomerForm {
  return {
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    city: "",
    district: "",
    address: "",
    postalCode: "",
    taxNumber: "",
    taxOffice: "",
    paymentMethod: "",
    paymentTerm: "0",
    creditLimit: "0",
    notes: "",
    customerType: "Nalbur",
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(date);
}

function getCustomerInitials(
  companyName: string
) {
  const words = companyName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "M";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0].charAt(0) +
    words[1].charAt(0)
  ).toUpperCase();
}

function customerToForm(
  customer: Customer
): CustomerForm {
  return {
    companyName: customer.company_name || "",
    contactName: customer.contact_name || "",
    phone: customer.phone || "",
    email: customer.email || "",
    city: customer.city || "",
    district: customer.district || "",
    address: customer.address || "",
    postalCode: customer.postal_code || "",
    taxNumber: customer.tax_number || "",
    taxOffice: customer.tax_office || "",
    paymentMethod: customer.payment_method || "",
    paymentTerm: String(
      customer.payment_term ?? 0
    ),
    creditLimit: String(
      customer.credit_limit ?? 0
    ),
    notes: customer.notes || "",
    customerType:
      customer.customer_type || "Nalbur",
  };
}

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showForm, setShowForm] =
    useState(false);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [showInactive, setShowInactive] =
    useState(false);

  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] =
    useState<CustomerForm>(
      createEmptyForm()
    );

  const [actionLoadingId, setActionLoadingId] =
    useState<string | null>(null);

  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const loadCustomers = useCallback(
    async () => {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(error);
        setError(
          "Müşteriler yüklenirken bir hata oluştu."
        );
        setLoading(false);
        return;
      }

      setCustomers(
        (data || []) as Customer[]
      );

      setLoading(false);
    },
    []
  );

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  /* ========================================================= */
  /* URL ÜZERİNDEN DÜZENLEME */
  /* ========================================================= */

  useEffect(() => {
    const editId =
      searchParams.get("edit");

    if (
      !editId ||
      customers.length === 0
    ) {
      return;
    }

    const customer = customers.find(
      (item) => item.id === editId
    );

    if (!customer) {
      return;
    }

    setEditingCustomer(customer);
    setForm(customerToForm(customer));
    setShowForm(true);
  }, [searchParams, customers]);

  /* ========================================================= */
  /* ESC İLE MODAL KAPAT */
  /* ========================================================= */

  useEffect(() => {
    if (!showForm) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape" && !saving) {
        closeForm();
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
  }, [showForm, saving]);

  /* ========================================================= */
  /* FORM */
  /* ========================================================= */

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement |
        HTMLSelectElement |
        HTMLTextAreaElement
    >
  ) {
    const { name } = event.target;
    let value = event.target.value;

    if (name === "phone") {
      value = value
        .replace(/\D/g, "")
        .slice(0, 11);
    }

    if (name === "postalCode") {
      value = value
        .replace(/\D/g, "")
        .slice(0, 5);
    }

    if (name === "taxNumber") {
      value = value
        .replace(/\D/g, "")
        .slice(0, 11);
    }

    if (name === "paymentTerm") {
      value = value
        .replace(/\D/g, "")
        .slice(0, 4);
    }

    if (name === "creditLimit") {
      value = value
        .replace(/[^\d.,]/g, "")
        .replace(",", ".");

      const parts = value.split(".");

      if (parts.length > 2) {
        value =
          parts[0] +
          "." +
          parts.slice(1).join("");
      }

      if (parts[1]?.length > 2) {
        value =
          parts[0] +
          "." +
          parts[1].slice(0, 2);
      }
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openNewCustomerForm() {
    setEditingCustomer(null);
    setForm(createEmptyForm());
    setError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function openEditForm(
    customer: Customer
  ) {
    setEditingCustomer(customer);
    setForm(customerToForm(customer));
    setError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function resetForm() {
    setForm(createEmptyForm());
    setEditingCustomer(null);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    resetForm();
    setShowForm(false);

    if (searchParams.get("edit")) {
      router.replace("/musteriler");
    }
  }

  /* ========================================================= */
  /* VALIDASYON */
  /* ========================================================= */

  function validateForm() {
    const companyName =
      form.companyName.trim();

    const phone =
      form.phone.trim();

    const email =
      form.email.trim();

    const postalCode =
      form.postalCode.trim();

    const taxNumber =
      form.taxNumber.trim();

    const paymentTerm =
      Number(form.paymentTerm || 0);

    const creditLimit =
      Number(form.creditLimit || 0);

    if (!companyName) {
      alert("İşletme adı zorunludur.");
      return false;
    }

    if (companyName.length < 2) {
      alert(
        "İşletme adı en az 2 karakter olmalıdır."
      );
      return false;
    }

    if (!phone) {
      alert("Telefon numarası zorunludur.");
      return false;
    }

    if (
      phone.length !== 11 ||
      !phone.startsWith("05")
    ) {
      alert(
        "Telefon numarası 05 ile başlayan 11 haneli bir numara olmalıdır."
      );
      return false;
    }

    if (email) {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        alert(
          "Lütfen geçerli bir e-posta adresi gir."
        );
        return false;
      }
    }

    if (
      postalCode &&
      postalCode.length !== 5
    ) {
      alert(
        "Posta kodu 5 haneli olmalıdır."
      );
      return false;
    }

    if (
      taxNumber &&
      taxNumber.length !== 10 &&
      taxNumber.length !== 11
    ) {
      alert(
        "Vergi numarası 10 veya 11 haneli olmalıdır."
      );
      return false;
    }

    if (
      !Number.isFinite(paymentTerm) ||
      paymentTerm < 0
    ) {
      alert(
        "Vade günü 0 veya daha büyük olmalıdır."
      );
      return false;
    }

    if (
      !Number.isFinite(creditLimit) ||
      creditLimit < 0
    ) {
      alert(
        "Kredi limiti 0 veya daha büyük olmalıdır."
      );
      return false;
    }

    return true;
  }

  /* ========================================================= */
  /* EKLE */
  /* ========================================================= */

  async function addCustomer(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    const payload = {
      company_name:
        form.companyName.trim(),
      contact_name:
        form.contactName.trim() || null,
      phone:
        form.phone.trim() || null,
      email:
        form.email.trim() || null,
      city:
        form.city.trim() || null,
      district:
        form.district.trim() || null,
      address:
        form.address.trim() || null,
      postal_code:
        form.postalCode.trim() || null,
      tax_number:
        form.taxNumber.trim() || null,
      tax_office:
        form.taxOffice.trim() || null,
      payment_method:
        form.paymentMethod || null,
      payment_term:
        Number(form.paymentTerm) || 0,
      credit_limit:
        Number(form.creditLimit) || 0,
      notes:
        form.notes.trim() || null,
      customer_type:
        form.customerType || "Nalbur",
      is_active: true,
    };

    const { error } = await supabase
      .from("customers")
      .insert(payload);

    if (error) {
      console.error(error);

      setError(
        error.message ||
          "Müşteri kaydedilirken bir hata oluştu."
      );

      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    setSuccessMessage(
      "Müşteri başarıyla kaydedildi."
    );

    await loadCustomers();

    setSaving(false);
  }

  /* ========================================================= */
  /* GÜNCELLE */
  /* ========================================================= */

  async function updateCustomer(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!editingCustomer) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    const payload = {
      company_name:
        form.companyName.trim(),
      contact_name:
        form.contactName.trim() || null,
      phone:
        form.phone.trim() || null,
      email:
        form.email.trim() || null,
      city:
        form.city.trim() || null,
      district:
        form.district.trim() || null,
      address:
        form.address.trim() || null,
      postal_code:
        form.postalCode.trim() || null,
      tax_number:
        form.taxNumber.trim() || null,
      tax_office:
        form.taxOffice.trim() || null,
      payment_method:
        form.paymentMethod || null,
      payment_term:
        Number(form.paymentTerm) || 0,
      credit_limit:
        Number(form.creditLimit) || 0,
      notes:
        form.notes.trim() || null,
      customer_type:
        form.customerType || "Nalbur",
    };

    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq(
        "id",
        editingCustomer.id
      );

    if (error) {
      console.error(error);

      setError(
        error.message ||
          "Müşteri güncellenirken bir hata oluştu."
      );

      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);

    router.replace("/musteriler");

    setSuccessMessage(
      "Müşteri başarıyla güncellendi."
    );

    await loadCustomers();

    setSaving(false);
  }

  /* ========================================================= */
  /* AKTİF / PASİF */
  /* ========================================================= */

  async function toggleCustomerStatus(
    customer: Customer
  ) {
    const nextStatus =
      !customer.is_active;

    const actionText = nextStatus
      ? "aktifleştirmek"
      : "pasifleştirmek";

    const confirmed =
      window.confirm(
        `"${customer.company_name}" müşterisini ${actionText} istediğine emin misin?`
      );

    if (!confirmed) {
      return;
    }

    setActionLoadingId(customer.id);
    setError("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("customers")
      .update({
        is_active: nextStatus,
      })
      .eq("id", customer.id);

    if (error) {
      console.error(error);

      setError(
        error.message ||
          "Müşteri durumu güncellenemedi."
      );

      setActionLoadingId(null);
      return;
    }

    setSuccessMessage(
      nextStatus
        ? "Müşteri aktifleştirildi."
        : "Müşteri pasifleştirildi."
    );

    await loadCustomers();

    setActionLoadingId(null);
  }

  /* ========================================================= */
  /* İSTATİSTİKLER */
  /* ========================================================= */

  const activeCustomers =
    useMemo(
      () =>
        customers.filter(
          (customer) =>
            customer.is_active !== false
        ),
      [customers]
    );

  const inactiveCustomers =
    useMemo(
      () =>
        customers.filter(
          (customer) =>
            customer.is_active === false
        ),
      [customers]
    );

  const newCustomersCount =
    useMemo(() => {
      const now = Date.now();

      const thirtyDaysAgo =
        now -
        30 *
          24 *
          60 *
          60 *
          1000;

      return customers.filter(
        (customer) => {
          const created =
            new Date(
              customer.created_at
            ).getTime();

          return (
            Number.isFinite(created) &&
            created >= thirtyDaysAgo
          );
        }
      ).length;
    }, [customers]);

  /* ========================================================= */
  /* ARAMA */
  /* ========================================================= */

  const filteredCustomers =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLocaleLowerCase("tr-TR");

      const source =
        showInactive
          ? customers.filter(
              (customer) =>
                customer.is_active ===
                false
            )
          : customers.filter(
              (customer) =>
                customer.is_active !==
                false
            );

      if (!normalizedSearch) {
        return source;
      }

      return source.filter(
        (customer) => {
          const searchableText = [
            customer.company_name,
            customer.contact_name,
            customer.phone,
            customer.email,
            customer.city,
            customer.district,
            customer.tax_number,
            customer.tax_office,
            customer.customer_type,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase(
              "tr-TR"
            );

          return searchableText.includes(
            normalizedSearch
          );
        }
      );
    }, [
      customers,
      search,
      showInactive,
    ]);

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-400">
              ESORA Yönetim Sistemi
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              Müşteriler
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Müşteri, ticari ve iletişim
              bilgilerini tek merkezden yönet.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewCustomerForm}
            className="w-full rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 sm:w-auto"
          >
            + Yeni Müşteri
          </button>
        </div>

        {/* ================================================= */}
        {/* MESAJLAR */}
        {/* ================================================= */}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-red-800">
                  İşlem gerçekleştirilemedi
                </p>

                <p className="mt-1 break-words text-sm text-red-700">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="text-lg text-red-500 hover:text-red-800"
                aria-label="Hata mesajını kapat"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-green-800">
                ✓ {successMessage}
              </p>

              <button
                type="button"
                onClick={() =>
                  setSuccessMessage("")
                }
                className="text-lg text-green-600 hover:text-green-900"
                aria-label="Başarı mesajını kapat"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* İSTATİSTİKLER */}
        {/* ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon="👥"
            title="Toplam Müşteri"
            value={customers.length}
            description="Sistemde kayıtlı tüm müşteriler"
          />

          <StatCard
            icon="✓"
            title="Aktif Müşteri"
            value={activeCustomers.length}
            description="Satış işlemlerinde kullanılabilir"
          />

          <StatCard
            icon="🆕"
            title="Yeni Müşteri"
            value={newCustomersCount}
            description="Son 30 gün içinde eklenen"
          />

          <StatCard
            icon="⏸️"
            title="Pasif Müşteri"
            value={inactiveCustomers.length}
            description="Arşivlenmiş müşteriler"
          />
        </div>

        {/* ================================================= */}
        {/* ARAMA + FİLTRE */}
        {/* ================================================= */}

        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                🔎
              </span>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Müşteri, yetkili, telefon, e-posta, şehir veya vergi no ara..."
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowInactive(
                  (current) => !current
                )
              }
              className={`rounded-xl border px-5 py-3 text-sm font-semibold transition ${
                showInactive
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {showInactive
                ? "✓ Pasif Müşteriler"
                : "Pasif Müşterileri Göster"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span>
              {filteredCustomers.length} müşteri
              gösteriliyor
            </span>

            {search && (
              <>
                <span>•</span>
                <span>
                  "{search}" aranıyor
                </span>
              </>
            )}
          </div>
        </div>

        {/* ================================================= */}
        {/* MÜŞTERİ LİSTESİ */}
        {/* ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />

              <p className="mt-4 text-sm text-gray-500">
                Müşteriler yükleniyor...
              </p>
            </div>
          ) : filteredCustomers.length ===
            0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
                {search
                  ? "🔎"
                  : showInactive
                    ? "⏸️"
                    : "👥"}
              </div>

              <h3 className="mt-4 font-semibold text-gray-900">
                {search
                  ? "Arama sonucu bulunamadı"
                  : showInactive
                    ? "Pasif müşteri bulunmuyor"
                    : "Henüz müşteri eklenmedi"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                {search
                  ? "Farklı bir müşteri adı, yetkili, telefon, e-posta veya vergi numarası deneyebilirsin."
                  : showInactive
                    ? "Pasifleştirilmiş müşteriler burada görüntülenir."
                    : "İlk müşterini ekleyerek satış ve cari süreçlerini yönetmeye başlayabilirsin."}
              </p>

              {!search &&
                !showInactive && (
                  <button
                    type="button"
                    onClick={
                      openNewCustomerForm
                    }
                    className="mt-5 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    + İlk Müşteriyi Ekle
                  </button>
                )}
            </div>
          ) : (
            <>
              {/* ================================================= */}
              {/* MOBİL KARTLAR */}
              {/* ================================================= */}

              <div className="divide-y divide-gray-100 md:hidden">
                {filteredCustomers.map(
                  (customer) => (
                    <div
                      key={customer.id}
                      className="p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">
                          {getCustomerInitials(
                            customer.company_name
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/musteriler/${customer.id}`
                                )
                              }
                              className="min-w-0 text-left"
                            >
                              <p className="truncate font-semibold text-gray-900">
                                {
                                  customer.company_name
                                }
                              </p>

                              <p className="mt-1 truncate text-xs text-gray-500">
                                {customer.contact_name ||
                                  "Yetkili belirtilmemiş"}
                              </p>
                            </button>

                            <CustomerStatusBadge
                              active={
                                customer.is_active !==
                                false
                              }
                            />
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-gray-50 p-2.5">
                              <p className="text-gray-400">
                                Telefon
                              </p>

                              <p className="mt-1 font-medium text-gray-700">
                                {customer.phone ||
                                  "-"}
                              </p>
                            </div>

                            <div className="rounded-lg bg-gray-50 p-2.5">
                              <p className="text-gray-400">
                                Tip
                              </p>

                              <p className="mt-1 font-medium text-gray-700">
                                {customer.customer_type ||
                                  "-"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/musteriler/${customer.id}`
                                )
                              }
                              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Detay
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEditForm(
                                  customer
                                )
                              }
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              Düzenle
                            </button>

                            <button
                              type="button"
                              disabled={
                                actionLoadingId ===
                                customer.id
                              }
                              onClick={() =>
                                toggleCustomerStatus(
                                  customer
                                )
                              }
                              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                                customer.is_active !==
                                false
                                  ? "border-red-200 text-red-600 hover:bg-red-50"
                                  : "border-green-200 text-green-700 hover:bg-green-50"
                              } disabled:opacity-50`}
                            >
                              {actionLoadingId ===
                              customer.id
                                ? "..."
                                : customer.is_active !==
                                    false
                                  ? "Pasifleştir"
                                  : "Aktifleştir"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* ================================================= */}
              {/* MASAÜSTÜ TABLO */}
              {/* ================================================= */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-gray-600">
                        İşletme
                      </th>

                      <th className="px-6 py-4 font-semibold text-gray-600">
                        Yetkili
                      </th>

                      <th className="px-6 py-4 font-semibold text-gray-600">
                        Telefon
                      </th>

                      <th className="px-6 py-4 font-semibold text-gray-600">
                        Konum
                      </th>

                      <th className="px-6 py-4 font-semibold text-gray-600">
                        Tip
                      </th>

                      <th className="px-6 py-4 font-semibold text-gray-600">
                        Durum
                      </th>

                      <th className="px-6 py-4 font-semibold text-gray-600">
                        İşlemler
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCustomers.map(
                      (customer) => (
                        <tr
                          key={customer.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/musteriler/${customer.id}`
                                )
                              }
                              className="flex items-center gap-3 text-left"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-bold text-gray-700">
                                {getCustomerInitials(
                                  customer.company_name
                                )}
                              </span>

                              <span className="min-w-0">
                                <span className="block max-w-[220px] truncate font-semibold text-gray-900 hover:underline">
                                  {
                                    customer.company_name
                                  }
                                </span>

                                <span className="mt-1 block text-xs text-gray-400">
                                  Eklenme:{" "}
                                  {formatDate(
                                    customer.created_at
                                  )}
                                </span>
                              </span>
                            </button>
                          </td>

                          <td className="px-6 py-4 text-gray-700">
                            {customer.contact_name ||
                              "-"}
                          </td>

                          <td className="px-6 py-4 text-gray-700">
                            {customer.phone || "-"}
                          </td>

                          <td className="px-6 py-4 text-gray-700">
                            {customer.district ||
                              customer.city
                              ? `${customer.district || "-"}${
                                  customer.city
                                    ? ` / ${customer.city}`
                                    : ""
                                }`
                              : "-"}
                          </td>

                          <td className="px-6 py-4">
                            <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-700">
                              {customer.customer_type ||
                                "-"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <CustomerStatusBadge
                              active={
                                customer.is_active !==
                                false
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/musteriler/${customer.id}`
                                  )
                                }
                                className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                              >
                                Detay
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openEditForm(
                                    customer
                                  )
                                }
                                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Düzenle
                              </button>

                              <button
                                type="button"
                                disabled={
                                  actionLoadingId ===
                                  customer.id
                                }
                                onClick={() =>
                                  toggleCustomerStatus(
                                    customer
                                  )
                                }
                                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                  customer.is_active !==
                                  false
                                    ? "border-red-200 text-red-600 hover:bg-red-50"
                                    : "border-green-200 text-green-700 hover:bg-green-50"
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                              >
                                {actionLoadingId ===
                                customer.id
                                  ? "İşleniyor..."
                                  : customer.is_active !==
                                      false
                                    ? "Pasifleştir"
                                    : "Aktifleştir"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ================================================= */}
        {/* ALT BİLGİ */}
        {/* ================================================= */}

        <div className="mt-5 flex flex-col justify-between gap-2 text-xs text-gray-400 sm:flex-row sm:items-center">
          <p>
            ESORA • Müşteri Yönetimi
          </p>

          <p>
            {activeCustomers.length} aktif müşteri
          </p>
        </div>
      </div>

      {/* ===================================================== */}
      {/* FORM MODALI */}
      {/* ===================================================== */}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Müşteri Yönetimi
                </p>

                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {editingCustomer
                    ? "Müşteriyi Düzenle"
                    : "Yeni Müşteri"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Formu kapat"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-2xl text-gray-500 transition hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={
                editingCustomer
                  ? updateCustomer
                  : addCustomer
              }
              className="grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-2"
            >
              {/* TEMEL BİLGİLER */}

              <FormSection
                title="Temel Bilgiler"
                description="Müşterinin temel iletişim bilgileri"
              />

              <FormField
                label="İşletme Adı"
                required
              >
                <input
                  name="companyName"
                  value={
                    form.companyName
                  }
                  onChange={handleChange}
                  placeholder="Örn. GNG Yapı Malzemeleri"
                  autoFocus
                  className="form-input"
                />
              </FormField>

              <FormField label="Yetkili">
                <input
                  name="contactName"
                  value={
                    form.contactName
                  }
                  onChange={handleChange}
                  placeholder="Yetkili adı ve soyadı"
                  className="form-input"
                />
              </FormField>

              <FormField
                label="Telefon"
                required
              >
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="05xxxxxxxxx"
                  className="form-input"
                />

                <p className="mt-1.5 text-xs text-gray-400">
                  05 ile başlayan 11 haneli
                  telefon numarası
                </p>
              </FormField>

              <FormField label="E-posta">
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="ornek@firma.com"
                  className="form-input"
                />
              </FormField>

              <FormField label="Müşteri Tipi">
                <select
                  name="customerType"
                  value={
                    form.customerType
                  }
                  onChange={handleChange}
                  className="form-input"
                >
                  {CUSTOMER_TYPES.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>
              </FormField>

              {/* ADRES */}

              <FormSection
                title="Adres Bilgileri"
                description="Teslimat ve iletişim adresi"
              />

              <FormField label="İl">
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="İstanbul"
                  className="form-input"
                />
              </FormField>

              <FormField label="İlçe">
                <input
                  name="district"
                  value={
                    form.district
                  }
                  onChange={handleChange}
                  placeholder="Sultangazi"
                  className="form-input"
                />
              </FormField>

              <FormField label="Posta Kodu">
                <input
                  name="postalCode"
                  value={
                    form.postalCode
                  }
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="34000"
                  className="form-input"
                />
              </FormField>

              <FormField
                label="Adres"
                fullWidth
              >
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Mahalle, sokak, bina no, daire no..."
                  className="form-input resize-none"
                />
              </FormField>

              {/* VERGİ */}

              <FormSection
                title="Vergi Bilgileri"
                description="Fatura ve ticari kayıt bilgileri"
              />

              <FormField label="Vergi Dairesi">
                <input
                  name="taxOffice"
                  value={
                    form.taxOffice
                  }
                  onChange={handleChange}
                  placeholder="Vergi dairesi"
                  className="form-input"
                />
              </FormField>

              <FormField label="Vergi No">
                <input
                  name="taxNumber"
                  value={
                    form.taxNumber
                  }
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="Vergi numarası"
                  className="form-input"
                />

                <p className="mt-1.5 text-xs text-gray-400">
                  10 haneli vergi no veya 11
                  haneli T.C. kimlik no
                </p>
              </FormField>

              {/* TİCARİ */}

              <FormSection
                title="Ticari Bilgiler"
                description="Ödeme ve kredi koşulları"
              />

              <FormField label="Varsayılan Ödeme Yöntemi">
                <select
                  name="paymentMethod"
                  value={
                    form.paymentMethod
                  }
                  onChange={handleChange}
                  className="form-input"
                >
                  {PAYMENT_METHODS.map(
                    (method) => (
                      <option
                        key={method.value}
                        value={method.value}
                      >
                        {method.label}
                      </option>
                    )
                  )}
                </select>
              </FormField>

              <FormField label="Vade (Gün)">
                <input
                  type="number"
                  name="paymentTerm"
                  value={
                    form.paymentTerm
                  }
                  onChange={handleChange}
                  min="0"
                  max="9999"
                  inputMode="numeric"
                  placeholder="0"
                  className="form-input"
                />
              </FormField>

              <FormField label="Kredi Limiti (₺)">
                <input
                  type="number"
                  name="creditLimit"
                  value={
                    form.creditLimit
                  }
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  className="form-input"
                />

                <p className="mt-1.5 text-xs text-gray-400">
                  0 = tanımlı kredi limiti yok
                </p>
              </FormField>

              {/* NOTLAR */}

              <FormSection
                title="Notlar"
                description="Müşteri hakkında dahili notlar"
              />

              <FormField
                label="Müşteri Notu"
                fullWidth
              >
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Müşteri hakkında özel notlar..."
                  className="form-input resize-none"
                />
              </FormField>

              {/* FORM BUTONLARI */}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end md:col-span-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Vazgeç
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Kaydediliyor..."
                    : editingCustomer
                      ? "Müşteriyi Güncelle"
                      : "Müşteriyi Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORM INPUT STYLES */}

      <style jsx global>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(209 213 219);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease;
        }

        .form-input:focus {
          border-color: rgb(17 24 39);
          box-shadow:
            0 0 0 3px
            rgb(17 24 39 / 0.06);
        }

        .form-input::placeholder {
          color: rgb(156 163 175);
        }
      `}</style>
    </main>
  );
}

/* ========================================================= */
/* STAT CARD */
/* ========================================================= */

function StatCard({
  icon,
  title,
  value,
  description,
}: {
  icon: string;
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-xl">
          {icon}
        </span>
      </div>

      <p className="mt-3 text-xs leading-5 text-gray-400">
        {description}
      </p>
    </div>
  );
}

/* ========================================================= */
/* CUSTOMER STATUS */
/* ========================================================= */

function CustomerStatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? "bg-green-500"
            : "bg-gray-400"
        }`}
      />

      {active ? "Aktif" : "Pasif"}
    </span>
  );
}

/* ========================================================= */
/* FORM SECTION */
/* ========================================================= */

function FormSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-gray-200 pb-2 md:col-span-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">
        {title}
      </h3>

      <p className="mt-1 text-xs text-gray-400">
        {description}
      </p>
    </div>
  );
}

/* ========================================================= */
/* FORM FIELD */
/* ========================================================= */

function FormField({
  label,
  required = false,
  fullWidth = false,
  children,
}: {
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        fullWidth
          ? "md:col-span-2"
          : ""
      }
    >
      <label className="mb-2 block text-sm font-semibold text-gray-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

/* ========================================================= */
/* PAGE */
/* ========================================================= */

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />

            <p className="mt-4 text-sm text-gray-500">
              Müşteriler yükleniyor...
            </p>
          </div>
        </main>
      }
    >
      <CustomersPageContent />
    </Suspense>
  );
}
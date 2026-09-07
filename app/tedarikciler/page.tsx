
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  tax_number: string | null;
  tax_office: string | null;
  payment_method: string | null;
  payment_term: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type SupplierTransaction = {
  supplier_id: string;
  transaction_type: string;
  amount: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function SuppliersPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    city: "",
    district: "",
    address: "",
    tax_number: "",
    tax_office: "",
    payment_method: "Nakit",
    payment_term: "0",
    notes: "",
  });

  async function loadData() {
    setLoading(true);
    setError("");

    const [supplierResult, transactionResult] = await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("supplier_transactions")
        .select("supplier_id, transaction_type, amount"),
    ]);

    if (supplierResult.error) {
      console.error(supplierResult.error);
      setError(supplierResult.error.message);
      setLoading(false);
      return;
    }

    if (transactionResult.error) {
      console.error(transactionResult.error);
      setError(transactionResult.error.message);
      setLoading(false);
      return;
    }

    setSuppliers((supplierResult.data || []) as Supplier[]);

    setTransactions(
      (transactionResult.data || []) as SupplierTransaction[]
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function getSupplierBalance(supplierId: string) {
    return transactions
      .filter((item) => item.supplier_id === supplierId)
      .reduce((balance, item) => {
        if (
          item.transaction_type === "purchase" ||
          item.transaction_type === "adjustment_debit"
        ) {
          return balance + Number(item.amount);
        }

        if (
          item.transaction_type === "payment" ||
          item.transaction_type === "adjustment_credit" ||
          item.transaction_type === "refund"
        ) {
          return balance - Number(item.amount);
        }

        return balance;
      }, 0);
  }

  function getSupplierPurchases(supplierId: string) {
    return transactions
      .filter(
        (item) =>
          item.supplier_id === supplierId &&
          item.transaction_type === "purchase"
      )
      .reduce((total, item) => total + Number(item.amount), 0);
  }

  async function saveSupplier() {
  setError("");

  if (!form.company_name.trim()) {
    setError("Firma adı zorunludur.");
    return;
  }

  const paymentTerm = Number(form.payment_term);

  if (paymentTerm < 0) {
    setError("Vade günü negatif olamaz.");
    return;
  }

  setSaving(true);

  const { error: insertError } = await supabase.rpc(
    "create_supplier",
    {
      p_company_name: form.company_name.trim(),
      p_contact_name: form.contact_name.trim() || null,
      p_phone: form.phone.trim() || null,
      p_email: form.email.trim() || null,
      p_city: form.city.trim() || null,
      p_district: form.district.trim() || null,
      p_address: form.address.trim() || null,
      p_tax_number: form.tax_number.trim() || null,
      p_tax_office: form.tax_office.trim() || null,
      p_payment_method: form.payment_method,
      p_payment_term: paymentTerm || 0,
      p_notes: form.notes.trim() || null,
    }
  );

  if (insertError) {
    console.error(insertError);
    setError(
      insertError.message || "Tedarikçi kaydedilemedi."
    );
    setSaving(false);
    return;
  }

  setForm({
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    city: "",
    district: "",
    address: "",
    tax_number: "",
    tax_office: "",
    payment_method: "Nakit",
    payment_term: "0",
    notes: "",
  });

  setShowModal(false);
  setSaving(false);

  await loadData();
}

  const filteredSuppliers = suppliers.filter((supplier) => {
    const searchText = search.toLowerCase().trim();

    if (!searchText) {
      return true;
    }

    return [
      supplier.company_name,
      supplier.contact_name,
      supplier.phone,
      supplier.city,
      supplier.district,
      supplier.tax_number,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(searchText)
      );
  });

  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.is_active
  ).length;

  const totalSupplierDebt = suppliers.reduce(
    (total, supplier) =>
      total + Math.max(getSupplierBalance(supplier.id), 0),
    0
  );

  const totalPurchases = suppliers.reduce(
    (total, supplier) =>
      total + getSupplierPurchases(supplier.id),
    0
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Tedarikçiler
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Tedarikçilerini ve alış ilişkilerini yönet
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              setShowModal(true);
            }}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Yeni Tedarikçi
          </button>
        </div>

        {/* SUMMARY */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Toplam Tedarikçi
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {suppliers.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Aktif Tedarikçi
            </div>

            <div className="mt-2 text-2xl font-bold text-emerald-600">
              {activeSuppliers}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Toplam Alış
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {formatMoney(totalPurchases)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Tedarikçi Borcu
            </div>

            <div className="mt-2 text-2xl font-bold text-orange-600">
              {formatMoney(totalSupplierDebt)}
            </div>
          </div>

        </section>

        {/* SEARCH */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tedarikçi, yetkili, telefon, şehir veya vergi no ara..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
          />
        </section>

        {/* ERROR */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-bold">
              İşlem gerçekleştirilemedi.
            </div>

            <div className="mt-1">
              {error}
            </div>
          </div>
        )}

        {/* LIST */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Tedarikçiler yükleniyor...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">🏭</div>

              <div className="mt-3 font-semibold text-slate-900">
                Tedarikçi bulunamadı
              </div>

              <div className="mt-1 text-sm text-slate-500">
                İlk tedarikçini ekleyerek başlayabilirsin.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">

                    <th className="px-5 py-4">
                      Tedarikçi
                    </th>

                    <th className="px-5 py-4">
                      İletişim
                    </th>

                    <th className="px-5 py-4">
                      Konum
                    </th>

                    <th className="px-5 py-4">
                      Ödeme
                    </th>

                    <th className="px-5 py-4">
                      Toplam Alış
                    </th>

                    <th className="px-5 py-4">
                      Cari Borç
                    </th>

                    <th className="px-5 py-4">
                      Durum
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {filteredSuppliers.map((supplier) => {
                    const balance = getSupplierBalance(
                      supplier.id
                    );

                    const purchases =
                      getSupplierPurchases(supplier.id);

                    return (
                      <tr
                        key={supplier.id}
                        onClick={() =>
                          router.push(
                            `/tedarikciler/${supplier.id}`
                          )
                        }
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                      >

                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {supplier.company_name}
                          </div>

                          {supplier.contact_name && (
                            <div className="mt-1 text-xs text-slate-400">
                              {supplier.contact_name}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {supplier.phone ? (
                            <div className="font-medium text-slate-700">
                              {supplier.phone}
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              -
                            </span>
                          )}

                          {supplier.email && (
                            <div className="mt-1 text-xs text-slate-400">
                              {supplier.email}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {[
                            supplier.city,
                            supplier.district,
                          ]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-700">
                            {supplier.payment_method || "Nakit"}
                          </div>

                          {Number(supplier.payment_term) > 0 && (
                            <div className="mt-1 text-xs text-slate-400">
                              {supplier.payment_term} gün vade
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {formatMoney(purchases)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={
                              balance > 0
                                ? "font-bold text-orange-600"
                                : "font-semibold text-emerald-600"
                            }
                          >
                            {formatMoney(balance)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {supplier.is_active ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Aktif
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                              Pasif
                            </span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}

        </section>

        {/* NEW SUPPLIER MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

              <div className="flex items-center justify-between border-b border-slate-200 p-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Yeni Tedarikçi
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Tedarikçi bilgilerini eksiksiz gir
                  </p>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="text-xl text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Firma Adı *
                  </label>

                  <input
                    value={form.company_name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        company_name: e.target.value,
                      })
                    }
                    placeholder="Örn: ABC Tesisat"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Yetkili
                  </label>

                  <input
                    value={form.contact_name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        contact_name: e.target.value,
                      })
                    }
                    placeholder="Yetkili kişi"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Telefon
                  </label>

                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        phone: e.target.value,
                      })
                    }
                    placeholder="05xx xxx xx xx"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    E-posta
                  </label>

                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email: e.target.value,
                      })
                    }
                    placeholder="ornek@mail.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Şehir
                  </label>

                  <input
                    value={form.city}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        city: e.target.value,
                      })
                    }
                    placeholder="İstanbul"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    İlçe
                  </label>

                  <input
                    value={form.district}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        district: e.target.value,
                      })
                    }
                    placeholder="Başakşehir"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Adres
                  </label>

                  <textarea
                    value={form.address}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: e.target.value,
                      })
                    }
                    rows={2}
                    placeholder="Tedarikçi adresi"
                    className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Vergi Numarası
                  </label>

                  <input
                    value={form.tax_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tax_number: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Vergi Dairesi
                  </label>

                  <input
                    value={form.tax_office}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tax_office: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Ödeme Yöntemi
                  </label>

                  <select
                    value={form.payment_method}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        payment_method: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  >
                    <option>Nakit</option>
                    <option>Havale / EFT</option>
                    <option>Kredi Kartı</option>
                    <option>Çek</option>
                    <option>Vadeli</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Vade (Gün)
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={form.payment_term}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        payment_term: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Notlar
                  </label>

                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        notes: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Tedarikçi hakkında not..."
                    className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  />
                </div>

              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 p-5">

                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Vazgeç
                </button>

                <button
                  onClick={saveSupplier}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving
                    ? "Kaydediliyor..."
                    : "Tedarikçiyi Kaydet"}
                </button>

              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}


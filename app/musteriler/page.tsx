"use client";

import { Suspense, useEffect, useState } from "react";
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
  created_at: string;
};

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showForm, setShowForm] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] = useState({
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
  });

  const filteredCustomers = customers.filter((customer) => {
    const searchText = search.toLowerCase();

    return (
      customer.company_name?.toLowerCase().includes(searchText) ||
      customer.contact_name?.toLowerCase().includes(searchText) ||
      customer.phone?.toLowerCase().includes(searchText)
    );
  });

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Müşteriler yüklenirken bir hata oluştu.");
    } else {
      setCustomers(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const editId = searchParams.get("edit");

    if (!editId || customers.length === 0) {
      return;
    }

    const customer = customers.find(
      (item) => item.id === editId
    );

    if (!customer) {
      return;
    }

    setEditingCustomer(customer);

    setForm({
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
      paymentTerm: String(customer.payment_term ?? 0),
      creditLimit: String(customer.credit_limit ?? 0),
      notes: customer.notes || "",
      customerType: customer.customer_type || "Nalbur",
    });

    setShowForm(true);
  }, [searchParams, customers]);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    let value = e.target.value;

    if (e.target.name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 11);
    }

    if (
      e.target.name === "paymentTerm" ||
      e.target.name === "creditLimit"
    ) {
      value = value.replace(/[^\d.]/g, "");
    }

    setForm({
      ...form,
      [e.target.name]: value,
    });
  }

  function resetForm() {
    setForm({
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
    });

    setEditingCustomer(null);
  }

  function validateForm() {
    if (!form.companyName || !form.phone) {
      alert("İşletme adı ve telefon zorunludur.");
      return false;
    }

    if (form.phone.length !== 11) {
      alert("Telefon numarası 11 haneli olmalıdır.");
      return false;
    }

    if (
      form.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    ) {
      alert("Lütfen geçerli bir e-posta adresi gir.");
      return false;
    }

    return true;
  }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("customers")
      .insert({
        company_name: form.companyName,
        contact_name: form.contactName,
        phone: form.phone,
        email: form.email,
        city: form.city,
        district: form.district,
        address: form.address,
        postal_code: form.postalCode,
        tax_number: form.taxNumber,
        tax_office: form.taxOffice,
        payment_method: form.paymentMethod,
        payment_term: Number(form.paymentTerm) || 0,
        credit_limit: Number(form.creditLimit) || 0,
        notes: form.notes,
        customer_type: form.customerType,
      });

    if (error) {
      console.error(error);
      alert("Müşteri kaydedilirken bir hata oluştu.");
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    setSaving(false);

    await loadCustomers();
  }

  async function updateCustomer(e: React.FormEvent) {
    e.preventDefault();

    if (!editingCustomer) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("customers")
      .update({
        company_name: form.companyName,
        contact_name: form.contactName,
        phone: form.phone,
        email: form.email,
        city: form.city,
        district: form.district,
        address: form.address,
        postal_code: form.postalCode,
        tax_number: form.taxNumber,
        tax_office: form.taxOffice,
        payment_method: form.paymentMethod,
        payment_term: Number(form.paymentTerm) || 0,
        credit_limit: Number(form.creditLimit) || 0,
        notes: form.notes,
        customer_type: form.customerType,
      })
      .eq("id", editingCustomer.id);

    if (error) {
      console.error(error);
      alert("Müşteri güncellenirken bir hata oluştu.");
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    setSaving(false);

    router.replace("/musteriler");

    await loadCustomers();
  }

  async function deleteCustomer(id: string) {
    const confirmed = window.confirm(
      "Bu müşteriyi silmek istediğine emin misin?"
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("SİLME HATASI: " + error.message);
      return;
    }

    await loadCustomers();
  }

  const activeCustomers = customers.length;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Müşteriler
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              ESORA müşteri yönetimi
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            + Yeni Müşteri
          </button>
        </div>

        {/* İSTATİSTİKLER */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">
              Toplam Müşteri
            </p>

            <p className="mt-2 text-3xl font-bold">
              {customers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">
              Aktif Müşteri
            </p>

            <p className="mt-2 text-3xl font-bold">
              {activeCustomers}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">
              Yeni Müşteri
            </p>

            <p className="mt-2 text-3xl font-bold">
              {customers.length}
            </p>
          </div>
        </div>

        {/* ARAMA */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Müşteri, yetkili veya telefon ara..."
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
          />
        </div>

        {/* MÜŞTERİ LİSTESİ */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              Müşteriler yükleniyor...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl">👥</div>

              <h3 className="mt-4 font-semibold">
                {search
                  ? "Arama sonucu bulunamadı"
                  : "Henüz müşteri eklenmedi"}
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                {search
                  ? "Farklı bir müşteri adı, yetkili veya telefon deneyebilirsin."
                  : "İlk müşterini ekleyerek başlayabilirsin."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-6 py-4">
                      İşletme
                    </th>

                    <th className="px-6 py-4">
                      Yetkili
                    </th>

                    <th className="px-6 py-4">
                      Telefon
                    </th>

                    <th className="px-6 py-4">
                      Konum
                    </th>

                    <th className="px-6 py-4">
                      Tip
                    </th>

                    <th className="px-6 py-4">
                      İşlemler
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium">
                        <button
                          onClick={() =>
                            router.push(
                              `/musteriler/${customer.id}`
                            )
                          }
                          className="text-left font-medium hover:underline"
                        >
                          {customer.company_name}
                        </button>
                      </td>

                      <td className="px-6 py-4">
                        {customer.contact_name || "-"}
                      </td>

                      <td className="px-6 py-4">
                        {customer.phone || "-"}
                      </td>

                      <td className="px-6 py-4">
                        {customer.district || "-"}
                        {customer.city
                          ? ` / ${customer.city}`
                          : ""}
                      </td>

                      <td className="px-6 py-4">
                        {customer.customer_type || "-"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingCustomer(customer);

                              setForm({
                                companyName:
                                  customer.company_name || "",
                                contactName:
                                  customer.contact_name || "",
                                phone:
                                  customer.phone || "",
                                email:
                                  customer.email || "",
                                city:
                                  customer.city || "",
                                district:
                                  customer.district || "",
                                address:
                                  customer.address || "",
                                postalCode:
                                  customer.postal_code || "",
                                taxNumber:
                                  customer.tax_number || "",
                                taxOffice:
                                  customer.tax_office || "",
                                paymentMethod:
                                  customer.payment_method || "",
                                paymentTerm:
                                  String(
                                    customer.payment_term ?? 0
                                  ),
                                creditLimit:
                                  String(
                                    customer.credit_limit ?? 0
                                  ),
                                notes:
                                  customer.notes || "",
                                customerType:
                                  customer.customer_type ||
                                  "Nalbur",
                              });

                              setShowForm(true);
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                          >
                            Düzenle
                          </button>

                          <button
                            onClick={() =>
                              deleteCustomer(customer.id)
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Sil
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
      </div>

      {/* FORM MODALI */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingCustomer
                    ? "Müşteriyi Düzenle"
                    : "Yeni Müşteri"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Müşteri ve ticari bilgilerini gir
                </p>
              </div>

              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="text-2xl text-gray-400 hover:text-black"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                editingCustomer
                  ? updateCustomer
                  : addCustomer
              }
              className="grid grid-cols-1 gap-5 md:grid-cols-2"
            >
              {/* TEMEL BİLGİLER */}
              <div className="md:col-span-2">
                <h3 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Temel Bilgiler
                </h3>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  İşletme Adı *
                </label>

                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="Örn. GNG Yapı Malzemeleri"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Yetkili
                </label>

                <input
                  name="contactName"
                  value={form.contactName}
                  onChange={handleChange}
                  placeholder="Yetkili adı"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Telefon *
                </label>

                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="05xxxxxxxxx"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />

                <p className="mt-1 text-xs text-gray-400">
                  11 haneli telefon numarası
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  E-posta
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="ornek@firma.com"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Müşteri Tipi
                </label>

                <select
                  name="customerType"
                  value={form.customerType}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-gray-900"
                >
                  <option>Nalbur</option>
                  <option>Yapı Market</option>
                  <option>Tesisatçı</option>
                  <option>Banyo & Mutfak</option>
                  <option>Toptancı</option>
                  <option>Bayi</option>
                  <option>Diğer</option>
                </select>
              </div>

              {/* ADRES */}
              <div className="mt-2 md:col-span-2">
                <h3 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Adres Bilgileri
                </h3>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  İl
                </label>

                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="İstanbul"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  İlçe
                </label>

                <input
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  placeholder="Sultangazi"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Posta Kodu
                </label>

                <input
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="34000"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Adres
                </label>

                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Mahalle, sokak, bina no, daire no..."
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              {/* VERGİ */}
              <div className="mt-2 md:col-span-2">
                <h3 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Vergi Bilgileri
                </h3>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Vergi Dairesi
                </label>

                <input
                  name="taxOffice"
                  value={form.taxOffice}
                  onChange={handleChange}
                  placeholder="Vergi dairesi"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Vergi No
                </label>

                <input
                  name="taxNumber"
                  value={form.taxNumber}
                  onChange={handleChange}
                  inputMode="numeric"
                  placeholder="Vergi numarası"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              {/* TİCARİ BİLGİLER */}
              <div className="mt-2 md:col-span-2">
                <h3 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Ticari Bilgiler
                </h3>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Ödeme Yöntemi
                </label>

                <select
                  name="paymentMethod"
                  value={form.paymentMethod}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-gray-900"
                >
                  <option value="">Seçiniz</option>
                  <option value="Peşin">Peşin</option>
                  <option value="Havale / EFT">
                    Havale / EFT
                  </option>
                  <option value="Kredi Kartı">
                    Kredi Kartı
                  </option>
                  <option value="Çek">Çek</option>
                  <option value="Vadeli">Vadeli</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Vade (Gün)
                </label>

                <input
                  type="number"
                  name="paymentTerm"
                  value={form.paymentTerm}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Kredi Limiti (₺)
                </label>

                <input
                  type="number"
                  name="creditLimit"
                  value={form.creditLimit}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              {/* NOTLAR */}
              <div className="mt-2 md:col-span-2">
                <h3 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Notlar
                </h3>
              </div>

              <div className="md:col-span-2">
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Müşteri hakkında özel notlar..."
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                />
              </div>

              {/* BUTONLAR */}
              <div className="flex justify-end gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium hover:bg-gray-50"
                >
                  Vazgeç
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
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
    </main>
  );
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 p-6">
          <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-500">
            Müşteriler yükleniyor...
          </div>
        </main>
      }
    >
      <CustomersPageContent />
    </Suspense>
  );
}

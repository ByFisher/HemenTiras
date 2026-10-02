"use client";

import { useState, type FormEvent } from "react";
import type { AdminRole, AdminStaff, MaskedUser, Paginated, UserRole } from "@/types/api";
import { adminApi } from "@/lib/services";
import { useApiQuery } from "@/lib/use-api";
import { ErrorAlert, EmptyState, SkeletonRows } from "@/components/feedback/Skeleton";
import { FormField, FormFieldset, FormInput, FormListbox } from "@/components/ui/form";

const roleOptions: { value: AdminRole; label: string }[] = [
  { value: "super_admin", label: "Süper Admin" },
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderatör" },
];

const assignableRoleOptions: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Süper Admin" },
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderatör" },
  { value: "shop_owner", label: "Dükkan Sahibi" },
  { value: "staff", label: "Personel" },
  { value: "customer", label: "Müşteri" },
  { value: "sponsor", label: "Sponsor" },
];

export function AdminStaffManager() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole | "">("");
  const [saving, setSaving] = useState(false);
  const [pendingRole, setPendingRole] = useState<Record<string, UserRole>>({});
  const [assignedRoles, setAssignedRoles] = useState<Record<string, UserRole>>({});
  const [userSearch, setUserSearch] = useState("");
  const [appliedUserSearch, setAppliedUserSearch] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const staffQuery = useApiQuery<AdminStaff[]>(["/admin/staff"], { list: true });
  const staff = staffQuery.data ?? [];
  const userQuery = useApiQuery<Paginated<MaskedUser>>(
    appliedUserSearch ? ["/admin/users", appliedUserSearch] : null,
    { enabled: appliedUserSearch.length >= 2, query: { search: appliedUserSearch, per_page: 20 } },
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role) {
      setError("Lütfen bir rol seçin.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await adminApi.createStaff({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role,
      });
      staffQuery.refresh();
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRole("");
      setNotice(`${created.name} hesabı oluşturuldu.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Yönetici hesabı oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (user: AdminStaff) => {
    const nextRole = pendingRole[user.id] ?? user.role;
    if (nextRole === user.role) return;
    setUpdatingId(user.id);
    setError("");
    setNotice("");
    try {
      const updated = await adminApi.updateStaffRole(user.id, nextRole);
      staffQuery.refresh();
      setNotice(`${updated.name} kullanıcısının rolü güncellendi.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kullanıcı rolü güncellenemedi.");
    } finally {
      setUpdatingId("");
    }
  };

  const assignRole = async (user: MaskedUser) => {
    const nextRole = assignedRoles[user.id];
    if (!nextRole || nextRole === user.role) return;
    setUpdatingId(user.id);
    setError("");
    setNotice("");
    try {
      await adminApi.updateStaffRole(user.id, nextRole);
      userQuery.refresh();
      staffQuery.refresh();
      setNotice(`${user.firstName} kullanıcısının rolü güncellendi.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kullanıcı rolü güncellenemedi.");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
        <h2 className="text-sm font-medium text-zinc-100">Yeni Admin / Moderatör Ekle</h2>
        <p className="mt-1 text-xs text-zinc-500">Yeni yönetici hesabı oluşturun. Parola en az 12 karakter olmalıdır.</p>
        <form onSubmit={submit} className="mt-4">
          <FormFieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="Ad Soyad" description="Hesapta gösterilecek tam ad.">
              <FormInput required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>
            <FormField label="E-posta" description="Benzersiz ve erişilebilir e-posta adresi.">
              <FormInput required type="email" maxLength={255} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormField>
            <FormField label="Telefon" description="Yönetici iletişim numarası.">
              <FormInput required type="tel" maxLength={40} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </FormField>
            <FormField label="Parola" description="En az 12 karakter.">
              <FormInput required type="password" minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </FormField>
            <FormListbox
              label="Rol"
              description="Rol, API tarafında yetki denetimiyle uygulanır."
              value={role}
              onChange={setRole}
              options={roleOptions}
              placeholder="Rol seçin"
              clearable={false}
            />
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving || !role}
                className="h-10 w-full rounded-md bg-lime-400 px-4 text-xs font-semibold text-zinc-950 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Kaydediliyor…" : "Hesap oluştur"}
              </button>
            </div>
          </FormFieldset>
        </form>
      </div>

      <ErrorAlert message={staffQuery.error || error} onRetry={staffQuery.refresh} />
      {notice && <p role="status" className="rounded-md border border-lime-900 bg-lime-950/30 p-3 text-xs text-lime-300">{notice}</p>}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
        <h2 className="text-sm font-medium text-zinc-100">Mevcut Kullanıcıya Rol Ata</h2>
        <p className="mt-1 text-xs text-zinc-500">Ad ile arayın; gizlilik için sonuçlarda iletişim bilgileri maskelenir.</p>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedUserSearch(userSearch.trim());
          }}
        >
          <FormField label="Kullanıcı adı" description="En az iki karakter girin.">
            <FormInput value={userSearch} onChange={(event) => setUserSearch(event.target.value)} minLength={2} maxLength={120} />
          </FormField>
          <button type="submit" disabled={userSearch.trim().length < 2} className="h-10 rounded-md border border-zinc-700 px-4 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-40">Kullanıcı ara</button>
        </form>
        {userQuery.error && <p role="alert" className="mt-3 text-xs text-rose-300">{userQuery.error}</p>}
        {userQuery.isLoading && <div className="mt-4"><SkeletonRows rows={2} columns={4} /></div>}
        {(userQuery.data?.data ?? []).length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-zinc-900/70 text-zinc-500">
                <tr><th className="px-3 py-2.5 font-medium">Kullanıcı</th><th className="px-3 py-2.5 font-medium">Mevcut rol</th><th className="px-3 py-2.5 font-medium">Yeni rol</th><th className="px-3 py-2.5 text-right font-medium">İşlem</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {userQuery.data?.data.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-3 text-zinc-200">{user.firstName} {user.maskedSurname}<p className="mt-1 text-[10px] text-zinc-600">{user.maskedEmail} · {user.maskedPhone}</p></td>
                    <td className="px-3 py-3 text-zinc-400">{assignableRoleOptions.find((option) => option.value === user.role)?.label ?? user.role}</td>
                    <td className="px-3 py-2">
                      <FormListbox
                        label="Atanacak rol"
                        description={`Rolü ${user.firstName} kullanıcısına ata.`}
                        value={assignedRoles[user.id] ?? user.role}
                        onChange={(next) => { if (next) setAssignedRoles((current) => ({ ...current, [user.id]: next })); }}
                        options={assignableRoleOptions}
                        clearable={false}
                        className="w-44"
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" disabled={updatingId === user.id || (assignedRoles[user.id] ?? user.role) === user.role} onClick={() => void assignRole(user)} className="rounded border border-zinc-700 px-3 py-2 text-[11px] text-zinc-200 hover:bg-zinc-900 disabled:opacity-40">
                        {updatingId === user.id ? "Kaydediliyor…" : "Rol ata"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {appliedUserSearch.length >= 2 && !userQuery.isLoading && (userQuery.data?.data ?? []).length === 0 && !userQuery.error && (
          <p className="mt-4 text-xs text-zinc-500">Aramayla eşleşen kullanıcı bulunamadı.</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-200">Yönetici hesapları</h2>
        {!staffQuery.isLoading && <span className="text-[11px] text-zinc-500">{staff.length} hesap</span>}
      </div>
      {staffQuery.isLoading ? <SkeletonRows rows={4} columns={5} /> : staff.length === 0 ? <EmptyState message="Yönetici hesabı bulunamadı." /> : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-zinc-900/70 text-zinc-500">
              <tr>
                <th className="px-3 py-3 font-medium">Ad Soyad</th>
                <th className="px-3 py-3 font-medium">E-posta / Telefon</th>
                <th className="px-3 py-3 font-medium">Durum</th>
                <th className="px-3 py-3 font-medium">Rol</th>
                <th className="px-3 py-3 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 bg-zinc-950">
              {staff.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-3 text-zinc-200">{user.name}</td>
                  <td className="px-3 py-3 text-zinc-400">{user.email}<p className="mt-1 text-[10px] text-zinc-600">{user.phone}</p></td>
                  <td className="px-3 py-3 text-zinc-400">{user.status}</td>
                  <td className="px-3 py-2">
                    <FormListbox
                      label="Rol"
                      description={`Yetki: ${user.name}`}
                      value={pendingRole[user.id] ?? user.role}
                      onChange={(next) => { if (next) setPendingRole((current) => ({ ...current, [user.id]: next })); }}
                      options={assignableRoleOptions}
                      clearable={false}
                      className="w-44"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      disabled={updatingId === user.id || (pendingRole[user.id] ?? user.role) === user.role}
                      onClick={() => void changeRole(user)}
                      className="rounded border border-zinc-700 px-3 py-2 text-[11px] text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {updatingId === user.id ? "Kaydediliyor…" : "Rolü kaydet"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

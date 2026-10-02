"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Plus, Save, Star, UserRound, X } from "lucide-react";
import { createShopStaff, getShopStaff, updateShopStaff, uploadShopContentImage } from "@/lib/shop-management-api";
import type { ShopStaffMember, StaffSkill, WeeklyWorkDay } from "@/types/portal";
import { FormCheckboxField, FormField, FormFieldset, FormInput, FormListbox, FormTextarea } from "@/components/ui/form";

const defaultSkills = (): StaffSkill[] => [{ name: "Sakal Kesimi", rating: 3 }, { name: "Cilt Bakımı", rating: 3 }];

export function ShopStaffPanel() {
  const [staff, setStaff] = useState<ShopStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [photo, setPhoto] = useState<File | undefined>();
  const [profilePhoto, setProfilePhoto] = useState<File | undefined>();
  const [form, setForm] = useState({ firstName: "", lastName: "", title: "Berber" as ShopStaffMember["title"], experienceYears: 0, biography: "" });

  useEffect(() => {
    let current = true;
    getShopStaff().then((result) => {
      if (current) setStaff(result);
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : "Personel listesi alınamadı.");
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, []);

  const selected = useMemo(() => staff.find((member) => member.id === selectedId), [staff, selectedId]);
  const customerAverage = (member: ShopStaffMember) => {
    const validRatings = member.customerRatings.filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
    return validRatings.length
      ? (validRatings.reduce((total, rating) => total + rating, 0) / validRatings.length).toFixed(1)
      : "—";
  };

  const saveMember = async (member: ShopStaffMember) => {
    if (!member.firstName.trim() || !member.lastName.trim() || !Number.isInteger(member.experienceYears) || member.experienceYears < 0 || member.experienceYears > 60) {
      setError("İsim, soyisim ve 0–60 arasında tam sayı deneyim yılı girin.");
      return;
    }
    const invalidDay = member.schedule.find((day) => day.enabled && (
      day.start >= day.end
      || day.breakStart >= day.breakEnd
      || day.breakStart < day.start
      || day.breakEnd > day.end
    ));
    if (invalidDay) {
      setError(`${invalidDay.day} çalışma ve mola saatlerini kontrol edin.`);
      return;
    }
    if (member.skills.some((skill) => !skill.name.trim() || skill.rating < 1 || skill.rating > 5)) {
      setError("Yetkinlik adı girilmeli ve puan 1 ile 5 arasında olmalıdır.");
      return;
    }
    setSavingId(member.id);
    setError("");
    setNotice("");
    try {
      let pendingPhotoUrl = member.pendingPhotoUrl;
      if (profilePhoto) {
        const submission = await uploadShopContentImage(
          profilePhoto,
          "staff_photo",
          `${member.firstName} ${member.lastName} · personel fotoğrafı`,
          member.id,
        );
        pendingPhotoUrl = submission.previewUrl;
      }
      const updated = await updateShopStaff(member.id, {
        firstName: member.firstName,
        lastName: member.lastName,
        title: member.title,
        experienceYears: member.experienceYears,
        biography: member.biography,
        schedule: member.schedule,
        skills: member.skills,
        workLogs: member.workLogs,
      });
      setStaff((current) => current.map((item) => item.id === updated.id ? { ...updated, pendingPhotoUrl } : item));
      setProfilePhoto(undefined);
      setNotice(`${updated.firstName} ${updated.lastName} bilgileri kaydedildi.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Personel bilgileri kaydedilemedi.");
    } finally {
      setSavingId("");
    }
  };

  const addStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const created = await createShopStaff({ ...form, schedule: defaultWeek(), skills: defaultSkills() });
      if (photo) {
        const submission = await uploadShopContentImage(
          photo,
          "staff_photo",
          `${form.firstName} ${form.lastName} · personel fotoğrafı`,
          created.id,
        );
        created.pendingPhotoUrl = submission.previewUrl;
      }
      setStaff((current) => [created, ...current]);
      setModalOpen(false);
      setPhoto(undefined);
      setForm({ firstName: "", lastName: "", title: "Berber", experienceYears: 0, biography: "" });
      setNotice("Personel profili admin onayına gönderildi. Müşteri tarafında onaylanana kadar görünmez.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Personel eklenemedi.");
    }
  };

  const updateSchedule = (member: ShopStaffMember, index: number, field: keyof WeeklyWorkDay, value: string | boolean) => {
    const schedule = member.schedule.map((day, dayIndex) => dayIndex === index ? { ...day, [field]: value } : day);
    setStaff((current) => current.map((item) => item.id === member.id ? { ...item, schedule } : item));
  };

  const updateSkill = (member: ShopStaffMember, index: number, field: keyof StaffSkill, value: string | number) => {
    const skills = member.skills.map((skill, skillIndex) => skillIndex === index ? { ...skill, [field]: value } : skill);
    setStaff((current) => current.map((item) => item.id === member.id ? { ...item, skills } : item));
  };

  const updateWorkLog = (member: ShopStaffMember, field: "workSummary" | "completedAppointments", value: string | number) => {
    const date = new Date().toLocaleDateString("en-CA");
    const existing = member.workLogs.find((log) => log.date === date);
    const nextLog = {
      date,
      workSummary: existing?.workSummary ?? "",
      completedAppointments: existing?.completedAppointments ?? 0,
      [field]: value,
    };
    const workLogs = existing
      ? member.workLogs.map((log) => log.date === date ? nextLog : log)
      : [nextLog, ...member.workLogs];
    setStaff((current) => current.map((item) => item.id === member.id ? { ...item, workLogs } : item));
  };

  if (loading) return <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">Personel yükleniyor...</p>;

  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Toplam personel", staff.length], ["Müşterilerde yayınlanan", staff.filter((member) => member.isApproved).length], ["Onay bekliyor", staff.filter((member) => !member.isApproved && member.approvalStatus === "pending_approval").length]].map(([label, value]) => <article key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums text-zinc-100">{value}</p></article>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-medium text-zinc-200">Personel ve performans</h2><p className="mt-1 text-xs text-zinc-500">Vardiya, mola, günlük iş ve yetkinlik bilgilerini yönetin.</p></div><button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950"><Plus size={13} />Yeni personel</button></div>
    {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
    {notice && <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">{notice}</p>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {staff.map((member) => <article key={member.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500">{member.photoUrl ? <Image src={member.photoUrl} alt={`${member.firstName} ${member.lastName}`} fill unoptimized sizes="48px" className="object-cover" /> : <UserRound size={20} />}</div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-medium text-zinc-100">{member.firstName} {member.lastName}</h3>{member.approvalStatus === "pending_approval" && <span className="rounded border border-amber-800 bg-amber-950/50 px-1.5 py-0.5 text-[9px] text-amber-200">⏳ Admin Onayı Bekliyor</span>}{member.approvalStatus === "rejected" && <span className="rounded border border-rose-900 px-1.5 py-0.5 text-[9px] text-rose-300">Reddedildi</span>}</div><p className="mt-1 text-xs text-zinc-500">{member.title} · {member.experienceYears} yıl deneyim</p></div>
          </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-zinc-800 py-3 text-center">
          <div><p className="flex items-center justify-center gap-1 text-sm font-semibold text-amber-300"><Star size={13} fill="currentColor" />{customerAverage(member)}</p><p className="mt-1 text-[9px] text-zinc-600">Ortalama puan</p></div>
          <div><p className="text-sm font-semibold text-zinc-200">{customerAverage(member)}</p><p className="mt-1 text-[9px] text-zinc-600">Müşteri puanı · {member.customerRatings.length} yorum</p></div>
          <div><p className="text-sm font-semibold text-zinc-200">{member.completedAppointmentCount}</p><p className="mt-1 text-[9px] text-zinc-600">Tamamlanan randevu</p></div>
        </div>
        <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-relaxed text-zinc-500">{member.biography || "Henüz biyografi eklenmedi."}</p>
        {member.pendingPhotoUrl && <p className="mt-2 text-[10px] text-amber-300">⏳ Yeni profil fotoğrafı admin onayı bekliyor</p>}
        <button type="button" onClick={() => { setSelectedId(member.id); setProfilePhoto(undefined); }} className="mt-3 w-full rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900">Personeli düzenle · çalışma planı & performans</button>
      </article>)}
    </div>

    {selected && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(""); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="staff-detail-title" className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between"><div><h2 id="staff-detail-title" className="text-sm font-semibold">{selected.firstName} {selected.lastName} · Haftalık Plan</h2><p className="mt-1 text-xs text-zinc-500">Çalışma saatleri, molalar ve günlük performans kaydı.</p></div><button type="button" onClick={() => setSelectedId("")} aria-label="Kapat"><X size={17} className="text-zinc-500" /></button></div>
        <FormFieldset className="mb-5 grid gap-3 rounded-lg border border-zinc-800 p-4 sm:grid-cols-2">
          <FormField label="İsim" description="Personelin adını girin."><FormInput value={selected.firstName} onChange={(event) => setStaff((current) => current.map((member) => member.id === selected.id ? { ...member, firstName: event.target.value } : member))} className="h-9 text-xs" /></FormField>
          <FormField label="Soyisim" description="Personelin soyadını girin."><FormInput value={selected.lastName} onChange={(event) => setStaff((current) => current.map((member) => member.id === selected.id ? { ...member, lastName: event.target.value } : member))} className="h-9 text-xs" /></FormField>
          <FormListbox
            label="Unvan"
            description="Personelin işletmedeki görevini seçin."
            value={selected.title}
            clearable={false}
            onChange={(value) => {
              if (value === "Berber" || value === "Kalfa" || value === "Çırak") {
                setStaff((current) => current.map((member) => member.id === selected.id ? { ...member, title: value } : member));
              }
            }}
            options={[{ value: "Berber", label: "Berber" }, { value: "Kalfa", label: "Kalfa" }, { value: "Çırak", label: "Çırak" }]}
          />
          <FormField label="Deneyim yılı" description="Personelin mesleki deneyim süresini girin."><FormInput type="number" min={0} max={60} step={1} value={selected.experienceYears} onChange={(event) => setStaff((current) => current.map((member) => member.id === selected.id ? { ...member, experienceYears: event.target.value === "" ? 0 : Number(event.target.value) } : member))} className="h-9 text-xs" /></FormField>
          <FormField label="Biyografi / uzmanlık" description="Personelin uzmanlıklarını ve mesleki geçmişini açıklayın." className="sm:col-span-2"><FormTextarea maxLength={1000} value={selected.biography} onChange={(event) => setStaff((current) => current.map((member) => member.id === selected.id ? { ...member, biography: event.target.value } : member))} className="text-xs" /></FormField>
          <FormField label="Yeni profil fotoğrafı" description="Yeni fotoğraf admin onayı tamamlanana kadar mevcut fotoğrafın yerini almaz." className="sm:col-span-2"><FormInput type="file" accept="image/*" onChange={(event) => setProfilePhoto(event.target.files?.[0])} className="text-xs file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:text-zinc-200" /></FormField>
        </FormFieldset>
        <FormFieldset className="space-y-2">{selected.schedule.map((day, index) => <div key={day.day} className="grid gap-2 rounded-md border border-zinc-800 p-3 sm:grid-cols-[100px_100px_1fr_1fr] sm:items-center">
          <span className="text-xs text-zinc-300">{day.day}</span>
          <FormCheckboxField label="Çalışıyor" description="Bu gün için randevu kabul edin." checked={day.enabled} onChange={(checked) => updateSchedule(selected, index, "enabled", checked)} />
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Başlangıç" description="Çalışma başlangıç saati."><FormInput aria-label={`${day.day} başlangıç`} type="time" disabled={!day.enabled} value={day.start} onChange={(event) => updateSchedule(selected, index, "start", event.target.value)} className="h-8 px-2 text-[10px]" /></FormField>
            <FormField label="Bitiş" description="Çalışma bitiş saati."><FormInput aria-label={`${day.day} bitiş`} type="time" disabled={!day.enabled} value={day.end} onChange={(event) => updateSchedule(selected, index, "end", event.target.value)} className="h-8 px-2 text-[10px]" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Mola başlangıç" description="Mola başlangıç saati."><FormInput aria-label={`${day.day} mola başlangıç`} type="time" disabled={!day.enabled} value={day.breakStart} onChange={(event) => updateSchedule(selected, index, "breakStart", event.target.value)} className="h-8 px-2 text-[10px]" /></FormField>
            <FormField label="Mola bitiş" description="Mola bitiş saati."><FormInput aria-label={`${day.day} mola bitiş`} type="time" disabled={!day.enabled} value={day.breakEnd} onChange={(event) => updateSchedule(selected, index, "breakEnd", event.target.value)} className="h-8 px-2 text-[10px]" /></FormField>
          </div>
        </div>)}</FormFieldset>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <FormFieldset className="space-y-3 rounded-lg border border-zinc-800 p-4"><h3 className="flex items-center gap-2 text-xs font-medium"><CalendarDays size={14} />Bugünkü çalışma</h3><FormField label="Bugün tamamlanan randevu sayısı" description="Bugün tamamlanan toplam randevu sayısını girin."><FormInput type="number" min={0} value={selected.workLogs.find((log) => log.date === new Date().toLocaleDateString("en-CA"))?.completedAppointments ?? 0} onChange={(event) => updateWorkLog(selected, "completedAppointments", Number(event.target.value))} className="h-9 text-xs" /></FormField><FormField label="Günlük iş / not özeti" description="Tamamlanan işler ve günlük notlar."><FormTextarea value={selected.workLogs.find((log) => log.date === new Date().toLocaleDateString("en-CA"))?.workSummary ?? ""} onChange={(event) => updateWorkLog(selected, "workSummary", event.target.value)} placeholder="Tamamlanan işler ve notlar..." className="text-xs" /></FormField><p className="text-[10px] text-zinc-600"><Clock3 size={12} className="mr-1 inline" />Veritabanındaki tamamlanmış randevular: {selected.completedAppointmentCount}</p></FormFieldset>
          <FormFieldset className="space-y-3 rounded-lg border border-zinc-800 p-4"><h3 className="text-xs font-medium">Yetkinlik değerlendirmesi</h3>{selected.skills.map((skill, index) => <div key={`${skill.name}-${index}`} className="grid grid-cols-[1fr_130px] items-center gap-2"><FormField label="Yetkinlik adı" description="Personelin hizmet yetkinliğini yazın."><FormInput value={skill.name} onChange={(event) => updateSkill(selected, index, "name", event.target.value)} className="h-8 px-2 text-xs" /></FormField><FormListbox<number> label="Puan" description="Yetkinlik puanı, 1 ile 5 arasında." value={skill.rating} onChange={(rating) => { if (rating !== "") updateSkill(selected, index, "rating", rating); }} options={[1, 2, 3, 4, 5].map((rating) => ({ value: rating, label: `${rating} / 5 ★` }))} /></div>)}<button type="button" onClick={() => setStaff((current) => current.map((item) => item.id === selected.id ? { ...item, skills: [...item.skills, { name: "Yeni yetkinlik", rating: 3 }] } : item))} className="rounded border border-zinc-800 px-2 py-1.5 text-[10px] text-zinc-400">Yetkinlik ekle</button></FormFieldset>
        </div>
        <div className="mt-4 flex items-center justify-between"><p className="text-[10px] text-zinc-600">Müşteri ortalaması {customerAverage(selected)} · {selected.customerRatings.length} tamamlanmış randevu değerlendirmesi · İşletme değerlendirmesi {selected.ownerRating.toFixed(1)}</p><button type="button" disabled={savingId === selected.id} onClick={() => void saveMember(selected)} className="rounded bg-zinc-100 px-3 py-2 text-xs text-zinc-950 disabled:opacity-50"><Save size={12} className="mr-1 inline" />{savingId === selected.id ? "Kaydediliyor..." : "Personel ve planı kaydet"}</button></div>
      </section>
    </div>}

    {modalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="add-staff-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 id="add-staff-title" className="text-sm font-semibold">Yeni personel ekle</h2><button type="button" onClick={() => setModalOpen(false)} aria-label="Kapat"><X size={16} /></button></div>
        <form onSubmit={addStaff}>
          <FormFieldset className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="İsim" description="Personelin adını girin."><FormInput required maxLength={80} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} className="h-9" /></FormField>
            <FormField label="Soyisim" description="Personelin soyadını girin."><FormInput required maxLength={80} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} className="h-9" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormListbox label="Unvan" description="Personelin işletmedeki görevini seçin." value={form.title} onChange={(title) => setForm({ ...form, title: title || "Berber" })} options={[{ value: "Berber", label: "Berber" }, { value: "Kalfa", label: "Kalfa" }, { value: "Çırak", label: "Çırak" }]} clearable={false} />
            <FormField label="Deneyim yılı" description="Tamamlanmış mesleki deneyim yılı."><FormInput required min={0} max={60} type="number" value={form.experienceYears} onChange={(event) => setForm({ ...form, experienceYears: Number(event.target.value) })} className="h-9" /></FormField>
          </div>
          <FormField label="Profil fotoğrafı" description="Fotoğraf admin onayına gönderilir."><FormInput type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0])} className="text-xs file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:text-zinc-200" /></FormField>
          <FormField label="Biyografi / uzmanlık" description="Personelin uzmanlıklarını ve mesleki geçmişini açıklayın."><FormTextarea maxLength={1000} value={form.biography} onChange={(event) => setForm({ ...form, biography: event.target.value })} className="text-xs" /></FormField>
          <button className="rounded bg-zinc-100 px-3 py-2 text-xs text-zinc-950">Profili onaya gönder</button>
          </FormFieldset>
        </form>
      </section>
    </div>}
  </section>;
}

function defaultWeek(): WeeklyWorkDay[] {
  return ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].map((day, index) => ({
    day,
    enabled: index < 6,
    start: "09:00",
    end: "19:00",
    breakStart: "13:00",
    breakEnd: "14:00",
  }));
}

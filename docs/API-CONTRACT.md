# HemenTıraş API Sözleşmesi (Laravel ↔ Next.js)

Laravel backend'i `backend/` altındadır. Tüm API uçları `/api/v1` öneki altında,
`Accept: application/json` başlığıyla ve Sanctum SPA cookie oturumu
(`credentials: include`, CSRF cookie/header) ile çağrılır. Frontend her yazma
isteğinden önce `/sanctum/csrf-cookie` alır.
Listeler hem düz dizi hem `{ data, meta }` zarfı dönebilecek şekilde normalize edilir
(`requestList` — `src/lib/api-client.ts`).

Müşteri hesapları frontend kayıt formundan açılabilir. Endpoint rolü istemciden almaz,
yalnızca aktif `customer` hesabı oluşturur ve kayıt sonrası oturum açar. Yönetim,
dükkan ve sponsor hesapları yalnızca backend komutuyla oluşturulur:

```powershell
php artisan app:user:create --name="Platform Yöneticisi" --email="admin@example.test" --role=super_admin
```

## Oturum

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/auth/register` | `{ name, email, phone?, password, password_confirmation }` → müşteri hesabı ve oturum |
| POST | `/auth/register-customer` | `{ fullName, email, password, phone }` → `customer/active` hesabı; ardından credentials login ile Sanctum oturumu başlatılır |
| POST | `/auth/register-shop` | `{ fullName, email, password, shopName, phone, city, district }` → `shop_owner/pending_approval` hesabı ve `is_approved=false` dükkan |
| POST | `/auth/register-shop-owner` | `{ name, email, phone, password, password_confirmation, shopName, city, district, address, shopPhone }` → `pending_approval` hesap ve dükkan başvurusu (oturum açılmaz) |
| POST | `/auth/login` | `{ email, password }` → aktif kullanıcı veya başvurusu bekleyen dükkan sahibinin profili ve Sanctum oturumu |
| POST | `/auth/logout` | Oturumu geçersiz kılar |
| GET | `/me` | Oturumdaki aktif, onay bekleyen dükkan sahibi veya onaylanmış kullanıcının kendi profili |

Müşteri kaydı otomatik oturum açar ve `/shops` sayfasına gider. Dükkan sahibi başvurusu için ana sayfadaki form kullanılır; başvuru `/approval-pending` ekranına yönlenir. Süper Admin `/admin/pending-shops` kuyruğundan dükkanı aktif ettiğinde dükkan sahibi `status=approved` olur ve sonraki girişinde `/shop/dashboard` sayfasına yönlendirilir. Bekleyen sahipler `/shop/*` API uçlarına erişemez.

## Hata sözleşmesi

```json
{ "message": "Yetkiniz yok.", "errors": { "starts_at": ["Geçmiş bir tarih seçilemez."] } }
```

Frontend `ApiError` sınıfına dönüştürür: `status === 0` → bağlantı yok / API adresi tanımsız,
`4xx/5xx` → sunucu mesajı. Alan hataları `fieldErrors` içinde forma yansıtılabilir.

---

## Auth & KVKK

| Yetki | Maskeleme |
|---|---|
| `super_admin` | Dökümde tüm alanlar, ancak KVKK gereği maskeli (`maskedSurname`, `maskedPhone`, `maskedEmail`) |
| `shop_owner` | Yalnızca kendi dükkanının randevulu müşterileri; tam iletişim bilgisi **yalnızca** aktif randevu veya açık müşteri onayı varsa `POST .../contact` ile açılır |
| `customer` | Kendi randevuları; başkasının verisine erişim 404/403 |

---

## Süper Admin

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/admin/sliders` | Tüm bannerlar sıralı; yalnızca `super_admin` |
| POST | `/admin/sliders` | Multipart: `title`, `image` (JPG/PNG/WebP, en fazla 5 MB), `is_active`, isteğe bağlı `description`, `link_url`, `link_label`, `sort_order` |
| PATCH | `/admin/sliders/{id}` | Banner metni, görseli, yönlendirmesi ve aktifliği günceller |
| PATCH | `/admin/sliders/order` | `{ ids: string[] }` ile tüm banner sırasını atomik olarak değiştirir |
| DELETE | `/admin/sliders/{id}` | Bannerı ve yüklenen görselini siler |
| GET | `/admin/shops` | `?search=&status=&city=&page=&per_page=` → `Shop[]` |
| GET | `/admin/users` | `?search=&status=&page=&per_page=` → `MaskedUser[]` |
| GET | `/admin/pending-approvals` | `?per_page=` → `is_approved=false` ve `pending_approval` dükkanlar |
| GET | `/admin/recent-users` | `?search=&per_page=` → newest-first maskeli müşteri listesi |
| GET | `/admin/sponsors` | `?search=&status=&page=&per_page=` → `Sponsor[]` |
| PATCH | `/admin/users/{id}/status` | `{ status: "active" \| "suspended" }` → `MaskedUser` |
| GET | `/admin/approvals` | `?status=pending_approval\|approved\|rejected` → `AdminApproval[]` |
| PATCH | `/admin/approvals/{id}/approve` | `204` veya `AdminApproval` |
| PATCH | `/admin/approvals/{id}/reject` | `{ rejection_reason: string }` → `AdminApproval` |
| PATCH | `/admin/shops/{id}/status` | `{ status: "active" \| "suspended" }` → Shop; aktif etme sahibi `approved`, askıya alma sahibi `suspended` yapar |

Middleware: `auth:sanctum` + yetkili hesap + `role:super_admin`. Shop owner API'leri yalnızca `active` veya admin onayıyla `approved` hesapları kabul eder.
İçerik kararları ve hesap/dükkan durum değişiklikleri transaction ve `audit_logs` kaydıyla uygulanır.

### Ana sayfa bannerları

`GET /sliders` herkese açıktır; yalnızca `is_active=true` kayıtları `sort_order` ve kimliğe göre artan sırada döndürür. Görsel URL'si `imageUrl`, yönlendirme `linkUrl` ve buton metni `linkLabel` alanlarıyla gelir. Ana sayfa aktif banner sayısı bir olduğunda sabit banner; en az iki olduğunda 4,5 saniyelik otomatik geçiş, döngü, sürükleme, oklar ve noktalar gösterir.

Yönlendirme yalnızca site içi `/path` veya HTTP(S) URL olabilir. Slider görselleri `public` diskindeki `sliders/` klasöründe tutulur; dağıtımda Laravel public storage link'i ve API alan adı tarayıcı tarafından erişilebilir olmalıdır.

## Dükkan yönetimi

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/shop/profile` | Oturum sahibinin dükkan profili |
| GET / POST | `/shop/services` | Yalnızca oturum sahibinin dükkanına ait hizmetler |
| PATCH | `/shop/services/{id}` | Dükkan kapsamlı hizmet güncellemesi |
| GET / POST | `/shop/staff` | Personel listesi/oluşturma; yeni personel onay bekler |
| PUT | `/shop/staff/{id}` | Yalnızca düzenlenebilir personel alanları |
| GET / POST | `/shop/content-submissions` | İçerik kuyruğu veya JSON/multipart içerik gönderimi |
| GET | `/content-submissions/{id}/preview` | Görseli yalnızca ilgili dükkan sahibi veya Süper Admin'e sunar |
| GET | `/shop/customers` | Yalnızca bu dükkanla randevusu olan kullanıcılar, maskeli |
| POST | `/shop/customers/{id}/contact` | Bugünkü aktif randevu veya müşteri izniyle geçici iletişim erişimi |

Shop verilerinin `shop_id` değeri istemciden alınmaz; sahiplik oturumdaki kullanıcıdan türetilir.
Personel puanı, tamamlanan randevu ve onay durumu API girdilerinden güncellenemez.

## B2C — Müşteri

`/shops`, mağaza detayları, hizmet/personel/yorum/uygunluk uçları ve randevu uçlarının
tamamı Sanctum oturumu ve `customer` rolü gerektirir. Müşteri menüsü ancak `/me`
üzerinden müşteri rolü doğrulandıktan sonra gösterilir.

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/shops` | `?search=&city=&district=&service=&min_rating=&sort=rating_desc\|rating_asc\|name_asc\|reviews_desc&page=&per_page=` → `Shop[]` (yalnızca `status=active` ve onaylı görseller) |
| GET | `/shops/{id}` | `Shop` (çalışma saatleri, adres, puan) |
| GET | `/shops/{id}/services` | `?is_active=true` → `Service[]` |
| GET | `/shops/{id}/staff` | `Staff[]` — `approvalStatus=approved` ve `isApproved=true` olanlar |
| GET | `/shops/{id}/staff/{staffId}` | `Staff` (hizmet listesi dahil) |
| GET | `/shops/{id}/staff/{staffId}/reviews` | `StaffReview[]` (paging) |
| GET | `/shops/{id}/staff/{staffId}/availability` | `?service_id=&date=YYYY-MM-DD` → `AppointmentSlot[]` |
| GET | `/appointments` | `?status=upcoming\|past\|pending\|confirmed\|completed\|cancelled` → `Appointment[]` |
| GET | `/appointments/{id}` | `Appointment` |
| POST | `/appointments` | `{ shopId, staffId, serviceId, startsAt, note? }` → `Appointment` |
| POST | `/appointments/{id}/cancel` | `{ reason? }` → `Appointment` |
| POST | `/appointments/{id}/demo-pay` | Yalnızca `PAYMENT_DEMO_ENABLED=true` olduğunda, müşterinin kendi randevusuna demo tahsilat yapar |
| POST | `/appointments/{id}/review` | `{ rating: 1..5, comment? }` → `StaffReview` |
| GET | `/me` | Oturumdaki kullanıcının `User` profili |

### Dükkan randevuları ve iptali

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/shop/appointments` | Dükkan sahibinin randevuları; isteğe bağlı `?status=pending\|confirmed\|completed\|cancelled\|no_show` |
| POST | `/shop/appointments/{id}/cancel` | `{ reason? }` ile randevu iptali; yalnızca oturumdaki sahibin dükkanı |

İptal işlemi tekrarlanabilir ve denetim günlüğüne yazılır. `pending`/`confirmed` randevu iptal edilir; başarılı tahsilat varsa tam tutar aynı ödeme sağlayıcısına iade edilir. Ödeme yoksa iade kaydı oluşturulmaz. Müşteri iptal uç noktası da aynı tam-iade politikasını izler. Sağlayıcı iade çağrısını tamamlayamazsa randevu iptali korunur, ödeme `refund_failed` olarak işaretlenir ve API `502` döner; aynı iptal ucu tekrar çağrıldığında aynı idempotency anahtarıyla iade tekrar denenir. İptal nedeni müşteri randevu görünümünde de sunulur.

Yerel ve test ortamlarında `PAYMENT_DRIVER=demo`, `PAYMENT_DEMO_ENABLED=true` kullanılır. Müşteri demo ödeme düğmesine bastığında iyzico benzeri bir test ekranına gider ve rastgele kart bilgileri girebilir; bu alanlar yalnızca tarayıcı belleğinde tutulur, ödeme API'sine gönderilmez ve saklanmaz. Ödeme tamamlandığında mevcut demo uç noktası yalnızca randevu kimliğiyle çağrılır; veritabanında test tahsilat/iade kayıtları üretir ve gerçek para hareketi oluşmaz. Demo uç noktası diğer ortamlarda kapalıdır. `PaymentGateway` arayüzü capture/refund sağlayıcı sınırıdır; canlı iyzico kullanımı için bu arayüze iyzico adaptörü eklenmeli, imzalı callback/webhook doğrulanmalı ve canlı anahtarlar sunucu tarafında tutulmalıdır. Uygulamanın bugünkü ödeme akışı iyzico canlı tahsilatı veya webhook işlemesi yapmaz.

Randevu yanıtındaki `payment` nesnesi `provider`, `status` (`unpaid`, `pending`, `paid`, `refund_pending`, `refunded`, `refund_failed`), `amount`, `currency` ve beklenen `refundAmount` alanlarını içerir. `demoPaymentEnabled` yalnızca demo ödemeyi açan ortam ayarında `true` olur.

### Kritik backend kuralları

1. **Çakışma engeli:** `POST /appointments` içinde `SELECT ... FOR UPDATE` ile personelin o
   zaman dilimindeki randevuları kilitle; benzersiz index (`staff_id`, `starts_at`, `status`).
2. **Yetenek sınırı:** randevu `shop_id`'si ile çağıran `shop_owner` eşleşmiyorsa 403.
3. **Değerlendirme kuralı:** yalnızca `status = completed` randevular için; bir randevuya
   bir kez yorum (`unique(appointment_id)`).
4. **KVKK:** `GET /admin/users` asla `full_name`, `phone`, `email` dönmemeli; maskeleme
   Laravel tarafında (accessor) yapılmalı, frontend'de değil.
5. **Onay kuyruğu:** kapak/profil görselleri yalnızca `approved` olduğunda
   `GET /shops/{id}` yanıtında `coverImageUrl`/`profileImageUrl` olarak döner. Yüklenen
   bekleyen/reddedilen dosyalar private disk üzerinde saklanır ve önizleme endpoint'i
   dükkan sahipliği/Süper Admin rolünü doğrular.

## Sponsor talepleri

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/sponsor/approval-requests` | Sponsor rolüyle reklam/bütçe/hedefleme/destek talebi oluşturma |
| GET | `/admin/sponsor-approval-requests` | Süper Admin onay kuyruğu |
| POST | `/admin/sponsor-approval-requests/{id}/approve` | Talebi onaylama ve audit kaydı |
| POST | `/admin/sponsor-approval-requests/{id}/reject` | Talebi reddetme ve audit kaydı |

Demo ödeme yalnızca randevu tahsilat/iade akışını yerel ortamda sınar; analitik, kampanya yayınlama ve diğer henüz modellenmemiş ekranlarda sahte değer gösterilmez.

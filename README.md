# HemenTıraş

HemenTıraş, Next.js müşteri arayüzü ve Laravel 13 API backend'inden oluşur. Mock veri, örnek kullanıcı ve sahte işlem fallback'i yoktur. Henüz API'ye bağlanmamış panel sayfaları açıkça devre dışı görünür.

## Gereksinimler

- PHP 8.3+, Composer ve `pdo_sqlite` (veya MySQL sürücüsü)
- Node.js 20+ ve npm

## İlk kurulum (Windows PowerShell)

### Laravel API

```powershell
Set-Location backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
php artisan key:generate
php artisan migrate
# Varsayılan oturum sürücüsü local geliştirmede file olarak ayarlıdır.
# Session tablosu kullanan bir kurulum için php artisan migrate komutunu tekrar çalıştırın.
php artisan db:seed
php artisan serve --host=0.0.0.0 --port=8001
```

`db:seed`, yönetim paneline ilk erişim için `admin@hementiras.com` / `Password123!` hesabını idempotent olarak oluşturur. Bu bilinen varsayılan parolayı ilk girişte değiştirin; bu seeder'ı production ortamında çalıştırmadan önce parola uygulamasını güvenli bir değere uyarlayın. Başka kullanıcılar için `app:user:create` komutu parolayı gizli olarak ister. Dükkan sahibi hesabı oluşturduktan sonra dükkan kaydını ekleyin:

```powershell
php artisan app:shop:create --owner="owner@example.test" --name="Dükkan Adı" --city="İstanbul" --district="Kadıköy" --phone="05..."
```

Dükkan, Süper Admin tarafından aktifleştirilene kadar müşteri aramasında yayınlanmaz.

### Next.js

Yeni bir terminalde:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm install
npm run dev
```

`.env.local` içindeki `NEXT_PUBLIC_API_URL` yerel API için `http://192.168.56.1:8001` olarak ayarlıdır. Laravel API, başka bir servisin varsayılan 8000 portunu kullanma ihtimaline karşı 8001 portunda dinler. Uygulamayı aynı makineden `localhost:3000` ile açın; başka bir cihazdan veya `192.168.x.x:3000` gibi LAN adresiyle açıyorsanız `.env.local` içindeki API URL'sini bu makinenin LAN IP'siyle değiştirin ve `backend/.env` içinde `FRONTEND_URLS` ile `SANCTUM_STATEFUL_DOMAINS` değerlerine frontend'inizin origin/host:port bilgisini ekleyin. `.env` değişikliklerinden sonra Laravel ve Next.js sunucularını yeniden başlatın. Karşılama sayfasındaki müşteri ve dükkan başvurusu bağlantıları sırasıyla `/register/customer` ve `/register/shop` akışlarına gider. Müşteri kaydı `/api/v1/auth/register-customer` ile tamamlanır, ardından Laravel credentials login çağrısı oturum açar. Dükkan başvurusu `/api/v1/auth/register-shop` endpoint'ine gönderilir; admin onayına kadar bekler ve `/approval-pending` sayfasına yönlenir. Giriş, rol ve onay durumuna uygun panele yönlendirir. API uçları Laravel Sanctum rol middleware'iyle korunur. Next.js 16 `proxy.ts` ek yönlendirme kontrolü sağlar.

## Gerçek API ve rol güvenliği

- Laravel veritabanında demo kayıtları oluşturulmaz. İlk yönetici `app:user:create` komutuyla eklenir.
- Yönetim API'leri `super_admin`, dükkan API'leri onaylanmış `shop_owner`, sponsor talepleri `sponsor`, mağaza kataloğu ve randevular `customer` rolü gerektirir. Müşteri kayıt endpoint'i yalnızca `customer`; dükkan başvuru endpoint'i yalnızca `pending_approval` durumlu `shop_owner` oluşturur.
- Dükkan sahipliği tüm dükkan sorgularında oturumdaki kullanıcıdan alınır; istek gövdesinden tenant kimliği kabul edilmez.
- Müşteri iletişim bilgileri maskeleme ve izin kontrolüyle döner; erişimler denetim günlüğüne yazılır. Bekleyen görseller public dizinde tutulmaz; önizleme oturum ve rol kontrolünden geçer.
- SQLite yerel geliştirme için varsayılandır. Canlı ortamda `.env` içindeki `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` ve `DB_PASSWORD` değerlerini kendi MySQL sunucunuza göre ayarlayın; ardından `php artisan migrate --force` çalıştırın. Canlıya çıkmadan `APP_DEBUG=false`, güçlü `APP_KEY`, HTTPS, doğru `FRONTEND_URL` ve `SANCTUM_STATEFUL_DOMAINS` ayarlayın.

## API kapsamı

Laravel uçları, rol kuralları ve frontend sözleşmesi için [API-CONTRACT.md](./docs/API-CONTRACT.md) dosyasına bakın. Gösterilmeyen sahte metrikler yerine henüz API'si tamamlanmamış bölümler devre dışı bırakılmıştır.

### Demo ödeme ve randevu iptali

Local/testing ortamlarında `PAYMENT_DRIVER=demo` ve `PAYMENT_DEMO_ENABLED=true` ile müşteri randevu ekranındaki demo ödeme düğmesi tahsilatı test eder; gerçek ödeme alınmaz. Dükkan sahibi randevuyu iptal ettiğinde tahsil edilmiş tutarın tamamı iade edilir; ödenmemiş randevuda yalnızca iptal kaydı tutulur. Demo ödeme özelliğini canlı ortamda etkinleştirmeyin. Ödeme sağlayıcısı `PaymentGateway` sözleşmesine bağlanır; canlıya geçişte gerçek sağlayıcı adaptörü ve doğrulanmış ödeme callback/webhook akışı yapılandırılmalıdır.

## Kontroller

```powershell
Set-Location backend
php artisan test
php artisan migrate:fresh --env=testing

Set-Location ..
npx tsc --noEmit
npm run lint
npm run build
```

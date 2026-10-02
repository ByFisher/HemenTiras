# Erişim kayıtları ve rol tabanlı yönetim

## Kapsam ve API

- `LegalAccessLoggerMiddleware` Laravel'e ulaşan başarılı ve hata yanıtlı HTTP isteklerini `access_logs` tablosuna yazar. Sorgu parametreleri, gövdeler, çerez değerleri ve kimlik doğrulama sırları kaydedilmez; yalnızca yol ve HTTP yöntemi tutulur.
- Giriş yapmamış ziyaretçilere `ht_visitor_id` adlı rastgele UUID çerezi verilir. Çerez `HttpOnly`, `SameSite=Lax` ve HTTPS isteğinde `Secure` olarak ayarlanır.
- IP ve ham User-Agent, cihaz sınıfı, UTC ve `APP_TIMEZONE` yerel zaman damgası, kullanıcı/anonim ziyaretçi anahtarı ve HTTP sonucu kaydedilir. İstemci kaynak portu PHP/Laravel'in güvenilir biçimde sağladığı bir değer olmadığından `client_port` null kalır; `SERVER_PORT` hedef sunucu portudur ve istemci portuymuş gibi kaydedilmez.
- Aydınlatma metni bildirimi ve belirli amaçlara ilişkin açık rıza `POST /api/v1/privacy/consents` ile ayrı ayrı kaydedilir. `PRIVACY_NOTICE_VERSION` ve `PRIVACY_MARKETING_CONSENT_VERSION` yayımlanan doküman sürümleriyle yapılandırılmalı; API yalnızca bu sürümleri kabul eder. Uygulama var olmayan bir rızayı varsaymaz; rıza kaydı yoksa erişim logundaki rıza alanları null olur. Bu uç nokta, geçerli aydınlatma metninin ve rıza arayüzünün yerine geçmez.
- Erişim kayıtları ve CSV dışa aktarımı yalnızca Süper Admin yetkisi gerektirir. CSV en fazla 10.000 satır içerir ve formül enjeksiyonuna karşı hücreleri kaçışlar.

## Dağıtım ve uyum sorumlulukları

1. `php artisan migrate --force` ile `access_logs`, `privacy_consents` ve yorum moderasyonu migration'larını uygulayın.
2. `APP_TIMEZONE=Europe/Istanbul` ayarını doğrulayın. UTC zaman damgası ayrıca saklanır.
3. Ters proxy/CDN arkasında, yalnızca kontrol ettiğiniz proxy adreslerini Laravel'in trusted-proxy ayarına tanımlayın. Aksi takdirde IP adresi proxy IP'si olabilir. İstemciden gelen `X-Forwarded-For` değerine doğrudan güvenmeyin.
4. Bu middleware yalnızca Laravel'e ulaşan istekleri görür. Next.js tarafından sunulan sayfa, CDN ve web sunucusu isteklerinin tamamı gerekiyorsa, güvenilir reverse proxy/edge loglarını ayrıca yapılandırıp erişimlerini ve saklama sürelerini yönetin.
5. Bu uygulama otomatik bir log silme süresi belirlemez. 5651 kapsamındaki yer sağlayıcı/erişim sağlayıcı rolünüzü, saklama süresini, KVKK işleme şartını, aydınlatma metnini, ilgili kişi süreçlerini, erişim yetkilerini ve yurt dışı aktarımı hukuk danışmanınız ve altyapı sağlayıcınızla doğrulayın. IP/User-Agent kişisel veri niteliği taşıyabilir; bu kod tek başına mevzuata uygunluk garantisi değildir.

## RBAC

Rol-permission matrisi `backend/config/permissions.php` dosyasında tanımlıdır ve `permission` middleware'i API'de uygulanır. Süper Admin tüm permission'lara sahiptir; Admin platform/dükkan/içerik işlemlerini yapabilir; Moderatör yorumları ve dükkan içeriklerini denetleyip destek taleplerini yönetebilir. Yönetici hesabı/rol atama ve erişim kayıtları yalnızca Süper Admin'e açıktır. Yetkiler istemci arayüzünün görünürlüğüne değil, Laravel middleware'ine dayanır.

Yeni yorumlar varsayılan olarak onay bekler; yalnızca onaylanan yorumlar herkese açık değerlendirme ve puanlamaya katılır. Eski yorumlar migration ile onaylı kalır. Yorum silme işlemi içerik metnini siler, ancak işlem kimliği ve sınırlı moderasyon bilgisi denetim günlüğünde tutulur.

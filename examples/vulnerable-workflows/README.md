# n8n Kasıtlı Zafiyetli Örnek İş Akışları (Vulnerable Workflows)

Bu klasör, **eğitim, güvenlik farkındalığı ve Wisely Güvenlik Denetim Motorunu (AST Audit Engine) test etmek** amacıyla kasıtlı olarak zafiyetli tasarlanmış n8n iş akışı örneklerini barındırır. 

Her dosya, n8n arayüzünden doğrudan içe aktarılabilir (`Workflows > Import from File`) standart JSON formatındadır.

> [!CAUTION]
> **ÖNEMLİ GÜVENLİK UYARISI**
> Bu iş akışları yalnızca izole bir test/laboratuvar ortamında kullanılmalıdır. Gerçek (production) bir ortamda **kesinlikle çalıştırılmamalıdır**. Buradaki zafiyetler, yetkisiz komut çalıştırma (RCE), yerel ağ taraması (SSRF), veri tabanı sızıntısı (SQLi) ve dosya okuma (LFI) riskleri barındırır.

---

## Örnek Senaryolar ve Zafiyet Matrisi

| # | Dosya Adı | Zafiyet Türü | CVSS / Risk | Wisely Kural Kodu |
|:---:|:---|:---|:---:|:---:|
| **01** | `01-command-injection.json` | İşletim Sistemi Komut Enjeksiyonu (`executeCommand`) | **Kritik (9.8)** | `SEC-001` |
| **02** | `02-ssrf.json` | Server-Side Request Forgery (`httpRequest`) | **Yüksek (8.6)** | `SEC-002` |
| **03** | `03-hardcoded-secrets.json` | Sabit Kodlanmış Kimlik Bilgileri & API Anahtarları | **Yüksek (7.5)** | `SEC-003` |
| **04** | `04-sql-injection.json` | SQL Enjeksiyonu (`postgres`) | **Kritik (9.8)** | `SEC-004` |
| **05** | `05-path-traversal.json` | Dizin Gezinme / Yetkisiz Dosya Erişimi (`readWriteFile`) | **Yüksek (7.5)** | `SEC-005` |
| **06** | `06-xss-html.json` | Cross-Site Scripting / Sanitize Edilmemiş HTML (`html`) | **Orta (6.1)** | `SEC-006` |
| **07** | `07-insecure-webhook.json` | Kimlik Doğrulamasız Açık Uç Nokta (`webhook`) | **Yüksek (7.3)** | `SEC-007` |

---

## Zafiyet İncelemeleri ve İyileştirme (Remediation)

### 01 — OS Komut Enjeksiyonu (`executeCommand`)
* **Hatalı Desen:** Webhook üzerinden gelen `host` parametresi shell komutuna doğrudan gömülmüştür:
  ```bash
  ping -c 1 {{ $json.body.host }}
  ```
* **Saldırı Vektörü:**
  ```bash
  curl -X POST https://<n8n-url>/webhook/cmd -d '{"host":"127.0.0.1; cat /etc/passwd"}'
  ```
* **İyileştirme:** Girdiyi asla shell interpolasyonuna sokmayın. Strict allowlist (örn: regex tabanlı IPv4 kontrolü) uygulayın veya komut çalıştırma düğümünü kaldırın.

---

### 02 — SSRF (`httpRequest`)
* **Hatalı Desen:** Dinamik HTTP düğümü, kullanıcının ilettiği `url` adresini doğrudan `GET` isteğiyle çeker:
  ```javascript
  url = "={{ $json.body.url }}"
  ```
* **Saldırı Vektörü:** Saldırgan `http://169.254.169.254/latest/meta-data/` (bulut metadata) veya `http://127.0.0.1:8080/admin` gibi iç ağ adreslerine sorgu atabilir.
* **İyileştirme:** URL şeması, izin verilen domain beyaz listesi (whitelist) ve iç IP (RFC 1918) bloklama kontrolleri ekleyin.

---

### 03 — Sabit Kodlanmış Gizli Bilgiler (Hardcoded Secrets)
* **Hatalı Desen:** API anahtarları, şifreler ve özel token'lar düğüm parametrelerine düz metin (plain-text) yazılmıştır:
  ```json
  "Authorization": "Bearer sk_live_4a1b2c3d...",
  "api_key": "AKIAIOSFODNN7EXAMPLE",
  "db_password": "P@ssw0rd!2024"
  ```
* **Risk:** İş akışı dışa aktarıldığında veya git deposuna eklendiğinde gizli anahtarlar sızar.
* **İyileştirme:** n8n'in yerel **Credentials** sistemini kullanın veya ortam değişkenlerinden (`$env.VAR_NAME`) okuyun.

---

### 04 — SQL Enjeksiyonu (`postgres`)
* **Hatalı Desen:** Sorgu dizesi kullanıcı girdisi ile doğrudan birleştirilmiştir:
  ```sql
  SELECT * FROM users WHERE username = '{{ $json.body.username }}'
  ```
* **Saldırı Vektörü:** `username = "' OR '1'='1"`
* **İyileştirme:** Parametreli sorgu (Prepared Statement) kullanın; kullanıcı girdisini asla SQL metnine eklemeyin.

---

### 05 — Path Traversal (`readWriteFile`)
* **Hatalı Desen:** Dosya yolu parametresi kullanıcıdan kontrolsüzce alınır:
  ```javascript
  fileName = "={{ $json.body.file }}"
  ```
* **Saldırı Vektörü:** `../../../../etc/passwd` veya hassas sistem konfigürasyon dosyaları okunabilir.
* **İyileştirme:** Dosya isimlerini yalnızca izin verilen dizin ve uzantılarla sınırlandırın; `..` karakter dizilerini engelleyin.

---

### 06 — XSS (`html`)
* **Hatalı Desen:** HTML çıktısı üretilirken kullanıcı girdisi kaçışlanmadan (unescaped) şablona basılır:
  ```html
  <h1>Hello {{ $json.body.name }}</h1>
  ```
* **Saldırı Vektörü:** `name = "<script>alert(document.cookie)</script>"`
* **İyileştirme:** HTML render işleminden önce DOMPurify veya yerleşik escape fonksiyonları ile girdiyi temizleyin.

---

### 07 — Kimlik Doğrulamasız Webhook (Unauthenticated Webhook)
* **Hatalı Desen:** Webhook tetikleyicisinde herhangi bir kimlik doğrulama veya yetki kontrolü tanımlanmamıştır.
* **Risk:** Uç nokta herkese açıktır; yetkisiz tetikleme, veri manipülasyonu ve DoS riski doğurur.
* **İyileştirme:** `Authentication = Header Auth` veya HMAC imza doğrulaması yapılandırın.

---

## Wisely ile Canlı Denetim Nasıl Yapılır?

1. n8n arayüzünüzde **Workflows ➔ Import from File** menüsünden bu klasördeki `.json` dosyalarını içe aktarın.
2. Wisely paneline giriş yapın ve **Settings ➔ n8n Environments** üzerinden n8n adresinizi ve API anahtarınızı bağlayın.
3. **"Sync Workflows"** düğmesine tıklayın.
4. **Security Audit** sayfasına geçin:
   - Wisely'nin AST analiz motoru bu 7 akışı anında tespit edecek,
   - Risk puanlarını hesaplayacak,
   - Zafiyetlerin kaynak düğümünü, tetikleyici nedenini ve çözüm önerilerini ekranda raporlayacaktır.

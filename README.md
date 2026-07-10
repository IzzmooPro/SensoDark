<div align="center">

# SensoDark

**A Chrome extension that darkens the web the way you'd do it by hand — scanning each page instead of slapping a filter over it.**

[![Version](https://img.shields.io/badge/version-1.7.0-7c5cfc)](https://github.com/IzzmooPro/SensoDark/releases)
[![Manifest](https://img.shields.io/badge/manifest-v3-2a2d34)](manifest.json)
[![Languages](https://img.shields.io/badge/languages-6-2a2d34)](_locales)

[English](#english) · [Türkçe](#türkçe)

</div>

---

## English

Most dark-mode extensions invert colors or dump a translucent filter on top of the page — brand colors go muddy, photos look wrong, and you can spot a "fake dark mode" site from across the room. SensoDark takes a different approach: it reads each element's actual computed color and decides, one surface at a time, whether it needs darkening — the same judgment a designer would make, applied automatically.

### Why it looks different

- **Detects real dark themes first.** Before touching anything, SensoDark samples the page. If you're already on Reddit, YouTube, or any site with a genuine dark theme, it does nothing — no double-darkening, no fighting the site's own styles.
- **Scans instead of filtering.** Every element gets judged on its own merits: light surfaces darken, dark text brightens, but saturated brand colors (buttons, banners, logos) are protected and left alone.
- **No white flash.** A tiny preload stylesheet paints the page dark before the very first frame, so there's no blinding flash of white while the real scan kicks in.
- **Hidden content is themed before it's shown.** Dropdown menus and modals get scanned while still `display: none`, so they're already dark the instant a site reveals them — no flash there either.
- **Hover states are covered.** Menu items and icon buttons that only turn light on `:hover` are caught the moment the pointer arrives, before the browser paints the hover state.
- **Icons stay visible.** Dark CSS-sprite icons designed for light backgrounds (including ones drawn via `::before`/`::after`) get a hue-preserving invert so they don't vanish into the new dark surface.
- **Shadow DOM aware.** Component-based sites that hide their markup behind shadow roots get scanned and watched too, not just the light DOM.

### Features

| | |
|---|---|
| **Darkness intensity** | Soft / Normal / Deep |
| **Per-site control** | Disable a site, mark it "already dark," or re-run detection with one click |
| **Automation** | Manual, follows your OS theme, or runs on a schedule |
| **Synced settings** | Stored via `chrome.storage.sync`; export/import from the options page |
| **Keyboard shortcuts** | `Alt+Shift+D` toggles globally, `Alt+Shift+A` toggles the current site |
| **Localized** | Turkish, English, German, Spanish, French, Russian |

### Install (developer mode)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.

### Build a release package

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

Reads the version straight from `manifest.json` and produces a clean, store-ready `dist/SensoDark-v<version>.zip` — no test files, no local backups. The popup's version label reads from the manifest too, so bumping a release is a one-line change in one file.

### Testing

[`test/test-page.html`](test/test-page.html) is a self-contained regression suite for the theming engine: surface hierarchy, brand-color preservation, form controls, pseudo-elements, CSS-sprite icons, hidden dropdown menus, and hover states. Each section describes the behavior you should see with the extension on and off.

### Project layout

| File | Responsibility |
|---|---|
| `content.js` | The theming engine: detection, scanning, mutation watching, restore |
| `preload.css` | Dark background before first paint (white-flash prevention) |
| `background.js` | Settings init, badge, alarms/automation, preload registration |
| `popup.*` | Quick controls — toggle, intensity, per-site, automation |
| `options.*` | Full settings, export/import |
| `dark-sites.js` | Known-dark site patterns |

### Contributing

Issues and pull requests are welcome. If you're fixing a theming edge case, add a section to `test/test-page.html` that reproduces it — it's the fastest way to prove a fix and keep it from regressing.

---

## Türkçe

Çoğu karanlık mod eklentisi renkleri ters çevirir ya da sayfanın üstüne yarı saydam bir filtre bindirir — marka renkleri bulanıklaşır, görseller tuhaf durur, "sahte karanlık mod" uygulanmış bir siteyi uzaktan tanırsınız. SensoDark farklı bir yol izler: her elemanın gerçek hesaplanmış rengini okur ve yüzey yüzey, koyulaşması gerekip gerekmediğine karar verir — bir tasarımcının elle yapacağı değerlendirmenin otomatikleştirilmiş hâli.

### Neden farklı görünüyor

- **Önce gerçek koyu temaları tanır.** Herhangi bir şeye dokunmadan önce sayfadan örnek alır. Zaten Reddit, YouTube gibi gerçek bir koyu temaya sahip bir sitedeyseniz hiçbir şey yapmaz — çifte karartma yok, sitenin kendi stilleriyle çakışma yok.
- **Filtrelemez, tarar.** Her eleman kendi haline göre değerlendirilir: açık yüzeyler koyulaşır, koyu metinler aydınlanır; doygun marka renkleri (butonlar, banner'lar, logolar) korunup dokunulmadan bırakılır.
- **Beyaz parlama yok.** Sayfa daha ilk kare boyanmadan önce ufak bir preload stil dosyası koyu arka planla açılır; gerçek tarama devreye girene kadar gözü alan bir beyaz parlama yaşanmaz.
- **Gizli içerik gösterilmeden önce temalanır.** Açılır menüler ve modallar hâlâ `display: none` durumundayken taranır; site onları gösterdiği an zaten koyudurlar — orada da parlama olmaz.
- **Hover durumları kapsanır.** Yalnızca `:hover` ile açık renge dönen menü öğeleri ve ikon butonları, imleç oraya geldiği anda, tarayıcı hover durumunu ekrana yansıtmadan önce yakalanır.
- **İkonlar görünür kalır.** Açık zemin için tasarlanmış koyu CSS-sprite ikonlar (`::before`/`::after` ile çizilenler dahil) renk tonunu koruyan bir invert filtresiyle yeni koyu yüzeyde kaybolmaz.
- **Shadow DOM farkında.** İşaretlemesini shadow root'ların arkasına saklayan bileşen tabanlı siteler de taranır ve izlenir, sadece açık DOM değil.

### Özellikler

| | |
|---|---|
| **Koyuluk seviyesi** | Yumuşak / Normal / Koyu |
| **Site bazlı kontrol** | Siteyi devre dışı bırakma, "zaten koyu" işaretleme, tek tıkla yeniden algılama |
| **Otomasyon** | Manuel, işletim sisteminin temasını takip eder, ya da bir zaman aralığında çalışır |
| **Senkron ayarlar** | `chrome.storage.sync` ile saklanır; seçenekler sayfasından dışa/içe aktarılır |
| **Klavye kısayolları** | `Alt+Shift+D` genel aç/kapat, `Alt+Shift+A` bu site için aç/kapat |
| **Diller** | Türkçe, İngilizce, Almanca, İspanyolca, Fransızca, Rusça |

### Kurulum (geliştirici modu)

1. Bu depoyu indirin veya klonlayın.
2. Chrome'da `chrome://extensions` sayfasını açın.
3. Sağ üstten **Geliştirici modu**'nu açın.
4. **Paketlenmemiş öğe yükle** ile bu klasörü seçin.

### Paket oluşturma

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

Sürümü doğrudan `manifest.json`'dan okur ve temiz, mağazaya yüklenmeye hazır bir `dist/SensoDark-v<sürüm>.zip` üretir — test dosyası ya da yerel yedek içermez. Popup'taki sürüm etiketi de manifest'ten okunur; bir sürümü yükseltmek tek dosyada tek satırlık bir değişikliktir.

### Test

[`test/test-page.html`](test/test-page.html), tema motoru için kendi kendine yeten bir regresyon paketidir: yüzey hiyerarşisi, marka renklerinin korunması, form elemanları, pseudo-element'ler, CSS-sprite ikonlar, gizli açılır menüler ve hover durumları. Her bölüm, eklenti açıkken/kapalıyken görmeniz gereken davranışı anlatır.

### Proje yapısı

| Dosya | Görev |
|---|---|
| `content.js` | Tema motoru: algılama, tarama, izleme, geri yükleme |
| `preload.css` | İlk boyama öncesi koyu arka plan (beyaz parlama önleme) |
| `background.js` | Ayar başlatma, rozet, alarm/otomasyon, preload kaydı |
| `popup.*` | Hızlı kontroller — aç/kapat, koyuluk, site bazlı, otomasyon |
| `options.*` | Ayrıntılı ayarlar, dışa/içe aktarma |
| `dark-sites.js` | Bilinen koyu site kalıpları |

### Katkıda bulunma

Issue ve pull request'ler memnuniyetle karşılanır. Bir tema uç durumunu düzeltiyorsanız, `test/test-page.html`'e o durumu yeniden üreten bir bölüm ekleyin — bir düzeltmeyi kanıtlamanın ve ileride bozulmasını önlemenin en hızlı yolu budur.

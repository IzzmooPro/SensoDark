# SensoDark

Akıllı karanlık görünüm — açık temalı siteleri otomatik karartan, zaten koyu olanlara dokunmayan Chrome (Manifest V3) eklentisi.

## Nasıl çalışır?

SensoDark, Dark Reader tarzı toptan filtre uygulamak yerine sayfayı **tarayarak** karartır:

- **Koyu tema algılama** — sayfa yüklenince ekrandan renk örnekleri alınır; site zaten koyuysa (Reddit, YouTube, koyu GitHub vb.) hiç dokunulmaz.
- **Akıllı tarayıcı** — açık yüzeyler koyu tonlara çekilir, koyu metinler aydınlatılır; doygun marka renkleri (butonlar, banner'lar, logolar) korunur.
- **Beyaz parlama önleme** — eklenti açıkken sayfa daha ilk boyamadan önce koyu arka planla açılır (`preload.css`).
- **Gizli eleman taraması** — açılır menüler ve modallar daha görünmeden karartılır; açıldıkları anda koyudurlar.
- **Hover düzeltmesi** — yalnızca `:hover` ile gelen açık zeminler, imleç elemana ilk geldiği anda (ekrana yansımadan) karartılır.
- **İkon kurtarma** — açık zemin için tasarlanmış koyu CSS-sprite ikonları (`::before`/`::after` dahil) renk tonunu koruyan bir invert filtresiyle görünür tutulur.
- **Shadow DOM desteği** — bileşen tabanlı sitelerdeki shadow root'lar da taranır ve izlenir.

## Özellikler

- **Koyuluk seviyesi:** Yumuşak / Normal / Koyu
- **Site bazlı kontrol:** siteyi devre dışı bırakma veya "zaten koyu" olarak işaretleme, yanlış algılamada tek tıkla yeniden algılama
- **Otomasyon:** manuel, sistem temasına göre veya saat aralığına göre otomatik açma/kapama
- **Senkron ayarlar:** `chrome.storage.sync` ile cihazlar arası; dışa/içe aktarma seçenekler sayfasında
- **Klavye kısayolları:** `Alt+Shift+D` genel aç/kapat, `Alt+Shift+A` bu site için aç/kapat
- **6 dil:** Türkçe, İngilizce, Almanca, İspanyolca, Fransızca, Rusça

## Kurulum (geliştirici)

1. Bu depoyu indirin veya klonlayın.
2. Chrome'da `chrome://extensions` sayfasını açın.
3. Sağ üstten **Geliştirici modu**'nu açın.
4. **Paketlenmemiş öğe yükle** ile bu klasörü seçin.

## Paketleme

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

Sürümü `manifest.json`'dan okur ve `dist/SensoDark-v<sürüm>.zip` üretir (test ve yedek dosyaları hariç, mağazaya yüklenmeye hazır). Popup'taki sürüm etiketi de manifest'ten okunur; sürüm yükseltmek için tek yer `manifest.json`'dır.

## Test

`test/test-page.html` sayfası, tema motorunun kritik vakalarını içerir: yüzey hiyerarşisi, marka renkleri, form elemanları, pseudo-element'ler, CSS-sprite ikonlar, gizli açılır menü ve hover senaryoları. Eklenti açıkken/kapalıyken sayfadaki beklenen davranışlar her maddenin başlığında yazar.

## Dosya yapısı

| Dosya | Görev |
|---|---|
| `content.js` | Tema motoru: algılama, tarama, izleme, geri yükleme |
| `preload.css` | İlk boyama öncesi koyu arka plan (beyaz parlama önleme) |
| `background.js` | Ayar başlatma, rozet, alarm/otomasyon, preload kaydı |
| `popup.*` | Hızlı kontroller (aç/kapat, koyuluk, site, otomasyon) |
| `options.*` | Ayrıntılı ayarlar, dışa/içe aktarma |
| `dark-sites.js` | Bilinen koyu site kalıpları |

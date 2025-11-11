# Guard Bot

Guard Bot, Discord sunucunuzu spam, raid, yetkisiz kanal/rol değişiklikleri, istenmeyen linkler ve küfürlü içerik gibi çeşitli tehditlere karşı korumak için tasarlanmış gelişmiş bir moderasyon botudur. Tamamen özelleştirilebilir ayarları ve detaylı loglama sistemi ile sunucunuzun güvenliğini sağlamanıza yardımcı olur.

## Özellikler

-   **Spam Koruması:** Belirlenen zaman aralığında çok fazla mesaj gönderen kullanıcıları algılar ve uyarır.
-   **Raid Koruması:** Kısa sürede çok sayıda kullanıcının sunucuya katılması durumunda raid modunu otomatik olarak etkinleştirir.
-   **Kanal Koruması:** Yetkisiz kanal oluşturma, silme ve güncelleme işlemlerini engeller ve geri alır.
-   **Rol Koruması:** Yetkisiz rol oluşturma, silme ve güncelleme işlemlerini engeller ve geri alır.
-   **Ban/Kick Koruması:** Yetkisiz ban ve kick işlemlerini algılar ve loglar.
-   **Link Engeli:** Discord davet linkleri ve diğer web sitesi linklerinin paylaşımını engeller.
    -   **GIF İstisnası:** Giphy veya Tenor gibi platformlardan gelen GIF linklerine izin verir.
    -   **Kanal/Rol İstisnası:** Belirli kanallarda veya belirli rollere sahip kullanıcılar için link paylaşımına izin verir.
-   **Whitelist Yönetimi:** Botun koruma sistemlerinin dışında tutulacak kullanıcıları ekleme, çıkarma ve listeleme imkanı sunar.
-   **Detaylı Loglama:** Tüm koruma eylemlerini ve yetkisiz girişimleri belirlenen log kanalına şık ve bilgilendirici embed mesajları ile kaydeder.
-   **Cezalandırma Sistemi:** Yetkisiz işlem yapan kullanıcıların rollerini otomatik olarak alır ve `config.json`'da belirlenen "Cezalı" rolünü verir.

## Kurulum

### Ön Gereksinimler

-   Node.js (v16.x veya üzeri önerilir)
-   npm (Node.js ile birlikte gelir)

### Adımlar

1.  **Dosyayı indirin:**

2.  **Dosya konumuna gidin:**
    ```bash
    cd C:\Users\"INDIRDIĞINIZ KONUM"\Discord.js-v14-GuardBot-main
    ```

3.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

4.  **`config.json` Dosyasını Yapılandırın:**
   `config.json` dosyasını projenizin ana dizininde oluşturun veya mevcutsa düzenleyin. Aşağıdaki gibi bir yapıya sahip olmalıdır:
   ```json
   {
       "token": "YOUR_BOT_TOKEN",
       "prefix": "!",
       "whitelist": [
           "YOUR_OWN_USER_ID",
           "BOT_USER_ID"
       ],
       "logChannel": "YOUR_LOG_CHANNEL_ID",
       "linkAllowedChannels": [],
       "linkAllowedRoles": [],
       "jailRoleId": "YOUR_JAIL_ROLE_ID",
       "settings": {
           "profanityFilter": {
               "enabled": true,
               "bannedWords": ["küfür1", "küfür2"]
           },
           "spam": {
               "enabled": true,
               "warningCount": 5,
               "interval": 10000
           },
           "raid": {
               "enabled": true,
               "userCount": 10,
               "time": 10000
           },
           "channel": {
               "create": true,
               "delete": true,
               "update": true
           },
           "role": {
               "create": true,
               "delete": true,
               "update": true
           },
           "banProtection": true,
           "kickProtection": true,
           "link": true,
           "webhook": true,
           "actionLimits": {
               "enabled": true,
               "banLimit": 1,
               "kickLimit": 2
           }
       }
   }
   ```
   -   `token`: Discord botunuzun token'ı. Discord Developer Portal üzerinden alabilirsiniz.
   -   `prefix`: Botunuzun komutlarını tetiklemek için kullanılacak önek (örn: `!`).
   -   `whitelist`: Botun koruma sistemlerinden etkilenmeyecek kullanıcı ID'lerinin listesi. Kendi ID'nizi ve botun kendi ID'sini eklemeniz şiddetle tavsiye edilir.
   -   `logChannel`: Botun tüm log mesajlarını göndereceği kanalın ID'si.
   -   `linkAllowedChannels`: Link paylaşımına izin verilecek kanalların ID'lerinin listesi.
   -   `linkAllowedRoles`: Link paylaşımına izin verilecek rollere sahip kullanıcıların rol ID'lerinin listesi.
   -   `jailRoleId`: Yetkisiz işlem yapan kullanıcılara verilecek "Cezalı" rolünün ID'si. Bu rolü Discord sunucunuzda oluşturmanız ve botun bu rolü atayabilmesi için yetkilerinin yeterli olduğundan emin olmanız gerekir.
   -   `settings.profanityFilter.bannedWords`: Engellenmesini istediğiniz küfürlü kelimelerin listesi.
   -   Diğer ayarlar, botun koruma mekanizmalarını detaylıca yapılandırmanıza olanak tanır.

4.  **Botu Çalıştırın:**
   ```bash
   node .
   ```
   Botunuzun çevrimiçi olduğunu ve sunucunuzu korumaya başladığını görmelisiniz.

## Kullanım

-   `!ayarlar`: Botun ana ayarlar menüsünü açar. Bu menüden tüm koruma ve cezalandırma ayarlarını yönetebilirsiniz.
-   `!whitelist add <@kullanıcı/ID>`: Belirtilen kullanıcıyı whitelist'e ekler.
-   `!whitelist remove <@kullanıcı/ID>`: Belirtilen kullanıcıyı whitelist'ten çıkarır.
-   `!whitelist list`: Whitelist'teki tüm kullanıcıları listeler.

## Katkıda Bulunma

Geliştirmelere katkıda bulunmak isterseniz, lütfen bir pull request gönderin veya bir issue açın.

## Lisans

Bu proje Apache 2.0 Lisansı altında lisanslanmıştır. Daha fazla bilgi için `LICENSE` dosyasına bakınız.

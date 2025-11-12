const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

function getConfig() {
    const configPath = path.resolve(__dirname, '../config.json');
    return JSON.parse(fs.readFileSync(configPath));
}

function saveConfig(config) {
    const configPath = path.resolve(__dirname, '../config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

module.exports = {
    name: 'ayarlar',
    description: 'Botun ayarlarını gösterir.',
    async execute(message, args) {
        if (message.author.id !== message.guild.ownerId) {
            return message.reply('Bu komutu kullanmak için sunucu sahibi olmalısınız.');
        }
        const config = getConfig();
        if (!config.whitelist.includes(message.client.user.id)) {
            config.whitelist.push(message.client.user.id);
            saveConfig(config);
        }
        await sendMainSettings(message);
    },
};

async function sendMainSettings(message) {
    const config = getConfig();
    const s = config.settings;
    const getStatus = (setting) => setting ? '✅' : '❌';

    const fetchUser = async (id) => {
        try {
            const user = await message.client.users.fetch(id);
            return user.tag;
        } catch {
            return `Bilinmeyen Kullanıcı (${id})`;
        }
    };

    const whitelistUsers = await Promise.all(config.whitelist.map(fetchUser));
    const whitelistText = whitelistUsers.length > 0 ? whitelistUsers.join('\n') : 'Whitelist\'te kimse yok.';

    const logChannel = message.guild.channels.cache.get(config.logChannel);
    const jailRole = config.settings.jailRoleId ? message.guild.roles.cache.get(config.settings.jailRoleId) : null;

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🔒 Sunucu Koruma Ayarları')
        .setDescription('Aşağıda botun mevcut ayarlarını görebilirsiniz. Ayarları değiştirmek için `/ayarla` komutunu kullanın.')
        .setThumbnail(message.guild.iconURL({ dynamic: true, size: 128 }))
        .addFields(
            { name: '📝 Log Kanalı', value: logChannel ? logChannel.toString() : 'Ayarlanmamış', inline: true },
            { name: '🚨 Cezalı Rolü', value: jailRole ? jailRole.toString() : 'Ayarlanmamış', inline: true },
            { name: '📜 Whitelist (' + config.whitelist.length + ')', value: `\`\`\`\n${whitelistText}\n\`\`\``, inline: false },
            { name: '🛡️ Korumalar', value: [
                `**Kanal Oluşturma:** ${getStatus(s.channel.create)}`,
                `**Kanal Silme:** ${getStatus(s.channel.delete)}`,
                `**Kanal Güncelleme:** ${getStatus(s.channel.update)}`,
                `**Rol Oluşturma:** ${getStatus(s.role.create)}`,
                `**Rol Silme:** ${getStatus(s.role.delete)}`,
                `**Rol Güncelleme:** ${getStatus(s.role.update)}`,
            ].join('\n'), inline: true },
            { name: '⚔️ Tehdit Önleme', value: [
                `**Spam:** ${getStatus(s.spam.enabled)}`,
                `**Raid:** ${getStatus(s.raid.enabled)}`,
                `**Link:** ${getStatus(s.link)}`,
                `**Ban:** ${getStatus(s.banProtection)}`,
                `**Kick:** ${getStatus(s.kickProtection)}`,
                `**Webhook:** ${getStatus(s.webhook)}`,
            ].join('\n'), inline: true },
             { name: '⚙️ Diğer Ayarlar', value: [
                `**Spam Mesaj:** \`${s.spam.warningCount}\``,
                `**Spam Süre:** \`${s.spam.interval / 1000}s\``,
                `**Raid Kullanıcı:** \`${s.raid.userCount}\``,
                `**Raid Süre:** \`${s.raid.time / 1000}s\``,
            ].join('\n'), inline: true },
        )
        .setFooter({ text: `${message.guild.name} Koruma Sistemi`, iconURL: message.client.user.avatarURL() })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Ayarları Değiştir (/ayarla)')
            .setStyle(ButtonStyle.Primary)
            .setCustomId('show_ayarla_command') // Bu buton bir işlem yapmayacak, sadece bilgilendirme amaçlı.
            .setDisabled(true) // Butonu tıklanamaz yapıyoruz.
    );

    await message.channel.send({ embeds: [embed], components: [row] });
}

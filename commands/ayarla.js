const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
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
    data: new SlashCommandBuilder()
        .setName('ayarla')
        .setDescription('Botun ayarlarını yapılandırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('koruma')
                .setDescription('Aç/Kapa şeklindeki koruma ayarlarını değiştirir.')
                .addStringOption(option =>
                    option.setName('ayar')
                        .setDescription('Değiştirilecek ayar.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Kanal Oluşturma', value: 'channel_create' },
                            { name: 'Kanal Silme', value: 'channel_delete' },
                            { name: 'Kanal Güncelleme', value: 'channel_update' },
                            { name: 'Rol Oluşturma', value: 'role_create' },
                            { name: 'Rol Silme', value: 'role_delete' },
                            { name: 'Rol Güncelleme', value: 'role_update' },
                            { name: 'Ban Koruması', value: 'banProtection' },
                            { name: 'Kick Koruması', value: 'kickProtection' },
                            { name: 'Link Engeli', value: 'link' },
                            { name: 'Webhook Koruması', value: 'webhook' },
                            { name: 'Spam Koruması', value: 'spam_enabled' },
                            { name: 'Raid Koruması', value: 'raid_enabled' },
                            { name: 'Küfür Engeli', value: 'profanityFilter_enabled' }
                        ))
                .addStringOption(option =>
                    option.setName('durum')
                        .setDescription('Ayarın yeni durumu.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Açık', value: 'true' },
                            { name: 'Kapalı', value: 'false' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('değer')
                .setDescription('Sayısal ayarları değiştirir.')
                .addStringOption(option =>
                    option.setName('ayar')
                        .setDescription('Değiştirilecek ayar.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Spam Uyarı Sayısı', value: 'spam_warningCount' },
                            { name: 'Spam Zaman Aralığı (saniye)', value: 'spam_interval' },
                            { name: 'Raid Kullanıcı Sayısı', value: 'raid_userCount' },
                            { name: 'Raid Zaman Aralığı (saniye)', value: 'raid_time' }
                        ))
                .addIntegerOption(option =>
                    option.setName('değer')
                        .setDescription('Ayarın yeni sayısal değeri.')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rol')
                .setDescription('Cezalı rolünü ayarlar.')
                .addRoleOption(option =>
                    option.setName('rol')
                        .setDescription('Yeni cezalı rolü.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('kanal')
                .setDescription('Log kanalını ayarlar.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Yeni log kanalı.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))),
    async execute(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: 'Bu komutu kullanmak için sunucu sahibi olmalısınız.', flags: [MessageFlags.Ephemeral] });
        }

        const config = getConfig();
        const subcommand = interaction.options.getSubcommand(false);
        const ayarAdi = interaction.options.getString('ayar') || (subcommand === 'rol' ? 'Cezalı Rolü' : 'Log Kanalı'); // Bu satır korunabilir veya düzenlenebilir.

        if (subcommand === 'koruma') {
            const ayar = interaction.options.getString('ayar');
            const durum = interaction.options.getString('durum') === 'true';
            const [category, key] = ayar.split('_');

            if (key) { // Örn: spam_enabled -> config.settings.spam.enabled
                config.settings[category][key] = durum;
            } else { // Örn: banProtection -> config.settings.banProtection
                 if (config.settings[category] && typeof config.settings[category] === 'object') {
                    config.settings[category][ayar.split('_')[1]] = durum;
                 } else {
                    config.settings[ayar] = durum;
                 }
            }
            
            saveConfig(config);
            await interaction.reply({ content: `✅ **${ayarAdi}** ayarı başarıyla **${durum ? 'Açık' : 'Kapalı'}** olarak ayarlandı.`, flags: [MessageFlags.Ephemeral] });

        } else if (subcommand === 'değer') {
            const ayar = interaction.options.getString('ayar');
            let değer = interaction.options.getInteger('değer');
            const [category, key] = ayar.split('_');

            // Kullanıcı saniye girer, biz milisaniyeye çeviririz
            if (key === 'interval' || key === 'time') {
                değer = değer * 1000;
            }

            config.settings[category][key] = değer;
            saveConfig(config);
            await interaction.reply({ content: `✅ **${ayarAdi}** ayarı başarıyla **${interaction.options.getInteger('değer')}** olarak ayarlandı.`, flags: [MessageFlags.Ephemeral] });

        } else if (subcommand === 'rol') {
            const rol = interaction.options.getRole('rol');
            config.settings.jailRoleId = rol.id;
            saveConfig(config);
            await interaction.reply({ content: `✅ **Cezalı Rolü** başarıyla ${rol} olarak ayarlandı.`, flags: [MessageFlags.Ephemeral] });
        
        } else if (subcommand === 'kanal') {
            const kanal = interaction.options.getChannel('kanal');
            config.logChannel = kanal.id;
            saveConfig(config);
            await interaction.reply({ content: `✅ **Log Kanalı** başarıyla ${kanal} olarak ayarlandı.`, flags: [MessageFlags.Ephemeral] });
        }
    },
};
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
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
    description: 'Botun ayarlarını gösterir ve yönetir.',
    async execute(message, args) {
        if (message.author.id !== message.guild.ownerId) {
            return message.reply('Bu komutu kullanmak için sunucu sahibi olmalısınız.');
        }

        const config = getConfig();
        if (!config.whitelist.includes(message.client.user.id)) {
            config.whitelist.push(message.client.user.id);
            saveConfig(config);
        }

        await sendMainSettings(message.channel);
    },

    async handleInteraction(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: 'Bu komutu kullanmak için sunucu sahibi olmalısınız.', ephemeral: true });
        }

        let config = getConfig();
        if (!config.whitelist.includes(interaction.client.user.id)) {
            config.whitelist.push(interaction.client.user.id);
            saveConfig(config);
        }
        const [action, value] = interaction.customId.split(':');

        if (interaction.isButton()) {
            if (action === 'toggle') {
                const [category, key] = value.split('_');
                let setting;

                if (key) {
                   
                    if (config.settings[category] && typeof config.settings[category][key] === 'boolean') {
                        config.settings[category][key] = !config.settings[category][key];
                    } else if (typeof config.settings[key] === 'boolean') { 
                    }
                } else { 
                    config.settings[category] = !config.settings[category];
                }
                saveConfig(config);
                await sendProtectionSettings(interaction, config);
            } else if (action === 'menu') {
                if (value === 'main') {
                    await sendMainSettings(interaction.channel, interaction);
                } else if (value === 'protection') {
                    await sendProtectionSettings(interaction, config);
                } else if (value === 'spam') {
                    await sendSpamSettings(interaction, config);
                } else if (value === 'raid') {
                    await sendRaidSettings(interaction, config);
                } else if (value === 'punishment') { 
                    await sendPunishmentSettings(interaction, config);
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            const [category, key] = interaction.values[0].split('_');
            await interaction.deferUpdate(); 
            const originalMessage = await interaction.editReply({ content: `Lütfen **${key}** için yeni bir değer girin.`, components: [], embeds: [], fetchReply: true }); 
            const channel = interaction.channel;
            let promptMessage = '';

            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 30000 });

            collector.on('collect', async m => {
                let replyContent = '';

                if (key === 'jailRoleId') {
                    const roleId = m.content.match(/^<@&(\d+)>$/)?.[1] || m.content;
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (!role) {
                        replyContent = 'Geçersiz rol ID\'si veya etiket. Lütfen geçerli bir rol belirtin.';
                    } else {
                        config.settings.jailRoleId = role.id;
                        saveConfig(config);
                        replyContent = `**Cezalı Rolü** başarıyla **${role.name}** olarak ayarlandı.`;
                    }
                } else {
                    const newValue = parseInt(m.content);
                    if (isNaN(newValue)) {
                        replyContent = 'Lütfen geçerli bir sayı girin. İşlem iptal edildi.';
                    } else {
                        if (category === 'spam') {
                            config.settings.spam[key] = newValue;
                        } else if (category === 'raid') {
                            config.settings.raid[key] = newValue;
                        } else if (category === 'actionLimits') {
                            config.settings.actionLimits[key] = newValue;
                        }
                        saveConfig(config);
                        replyContent = `**${key}** ayarı başarıyla **${newValue}** olarak ayarlandı.`;
                    }
                }
                await m.delete().catch(() => {});
                await channel.send({ content: replyContent, ephemeral: true }).then(msg => setTimeout(() => msg.delete(), 5000));

           
                if (category === 'spam') {
                    await sendSpamSettings({ ...interaction, guild: interaction.guild, message: originalMessage }, getConfig());
                } else if (category === 'raid') {
                    await sendRaidSettings({ ...interaction, guild: interaction.guild, message: originalMessage }, getConfig());
                } else if (category === 'actionLimits' || key === 'jailRoleId') {
             
                    await sendPunishmentSettings({ ...interaction, guild: interaction.guild, message: originalMessage }, getConfig());
                }
            });
        }
    }
};

async function sendMainSettings(channel, interaction) {
    const config = getConfig();
    const s = config.settings;
    const getStatus = (setting) => setting ? '✅ Açık' : '❌ Kapalı';

    const fetchUser = async (id) => {
        try {
            const user = await channel.client.users.fetch(id);
            return user.tag;
        } catch {
            return `Bilinmeyen Kullanıcı (${id})`;
        }
    };

    const whitelistUsers = await Promise.all(config.whitelist.map(fetchUser));
    const whitelistText = whitelistUsers.length > 0 ? whitelistUsers.join('\n') : 'Whitelist\'te kimse yok.';

    const logChannel = channel.guild.channels.cache.get(config.logChannel);
    const jailRole = config.settings.jailRoleId ? channel.guild.roles.cache.get(config.settings.jailRoleId) : null;

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🔒 Sunucu Koruma Ayarları')
        .setDescription('Bu panelden botun koruma ayarlarını yönetebilirsiniz.')
        .setThumbnail(channel.guild.iconURL({ dynamic: true, size: 128 }))
        .addFields(
            { name: '📝 Log Kanalı', value: logChannel ? logChannel.toString() : 'Ayarlanmamış', inline: true },
            { name: '🚨 Cezalı Rolü', value: jailRole ? jailRole.toString() : 'Ayarlanmamış', inline: true },
            { name: '📜 Whitelist (' + config.whitelist.length + ')', value: `\`\`\`\n${whitelistText}\n\`\`\``, inline: false },
            { name: '🛡️ Korumalar', value: [
                `**Kanal:** ${getStatus(s.channel.create || s.channel.delete || s.channel.update)}`,
                `**Rol:** ${getStatus(s.role.create || s.role.delete || s.role.update)}`,
                `**Ban/Kick:** ${getStatus(s.banProtection || s.kickProtection)}`
            ].join('\n'), inline: true },
            { name: '⚔️ Tehdit Önleme', value: [
                `**Spam:** ${getStatus(s.spam.enabled)}`,
                `**Raid:** ${getStatus(s.raid.enabled)}`,
                `**Link:** ${getStatus(s.link)}`
            ].join('\n'), inline: true },
        )
        .setFooter({ text: `${channel.guild.name} Koruma Sistemi`, iconURL: channel.client.user.avatarURL() })
        .setTimestamp();

    const rows = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('menu:protection').setLabel('🛡️ Korumaları Yönet').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('menu:spam').setLabel('💬 Spam Ayarları').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('menu:raid').setLabel('⚔️ Raid Ayarları').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('menu:punishment').setLabel('🚨 Cezalandırma Ayarları').setStyle(ButtonStyle.Secondary),
        ),
    ];

    if (interaction) {
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
             await interaction.message.edit({ content: null, embeds: [embed], components: rows });
        } else {
             await interaction.update({ embeds: [embed], components: rows });
        }
    } else {
        await channel.send({ embeds: [embed], components: rows });
    }
}

async function sendProtectionSettings(interaction, config) {
    const s = config.settings;
    const getStatus = (setting) => setting ? '✅' : '❌';

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🛡️ Koruma Ayarları')
        .setDescription('Aşağıdaki düğmeleri kullanarak ilgili korumaları açıp kapatabilirsiniz.')
        .addFields(
            { name: 'Kanal Korumaları', value: `Oluşturma: ${getStatus(s.channel.create)}\nSilme: ${getStatus(s.channel.delete)}\nGüncelleme: ${getStatus(s.channel.update)}`, inline: true },
            { name: 'Rol Korumaları', value: `Oluşturma: ${getStatus(s.role.create)}\nSilme: ${getStatus(s.role.delete)}\nGüncelleme: ${getStatus(s.role.update)}`, inline: true },
            { name: 'Diğer Korumalar', value: `Ban: ${getStatus(s.banProtection)}\nKick: ${getStatus(s.kickProtection)}\nLink: ${getStatus(s.link)}\nWebhook: ${getStatus(s.webhook)}`, inline: true }
        );

    const rows = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('toggle:channel_create').setLabel('Kanal Oluşturma').setStyle(s.channel.create ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('toggle:channel_delete').setLabel('Kanal Silme').setStyle(s.channel.delete ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('toggle:channel_update').setLabel('Kanal Güncelleme').setStyle(s.channel.update ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('toggle:role_create').setLabel('Rol Oluşturma').setStyle(s.role.create ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('toggle:role_delete').setLabel('Rol Silme').setStyle(s.role.delete ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('toggle:role_update').setLabel('Rol Güncelleme').setStyle(s.role.update ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents( 
            new ButtonBuilder().setCustomId('toggle:banProtection').setLabel('Ban Koruması').setStyle(s.banProtection ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('toggle:kickProtection').setLabel('Kick Koruması').setStyle(s.kickProtection ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('toggle:link').setLabel('Link Engeli').setStyle(s.link ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('toggle:webhook').setLabel('Webhook Koruması').setStyle(s.webhook ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu:main').setLabel('↩️ Ana Menüye Dön').setStyle(ButtonStyle.Secondary))
    ];

    await interaction.message.edit({ content: null, embeds: [embed], components: rows });
}


async function sendPunishmentSettings(interaction, config) {
    const s = config.settings;
    const getStatus = (setting) => setting ? '✅ Açık' : '❌ Kapalı';

    const jailRole = s.jailRoleId ? interaction.guild.roles.cache.get(s.jailRoleId) : null;

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🚨 Cezalandırma Ayarları')
        .setDescription('Yetkisiz işlem yapan kullanıcılara uygulanacak cezaları ve limitleri yönetin.')
        .addFields(
            { name: 'Ban Koruması', value: getStatus(s.banProtection), inline: true },
            { name: 'Kick Koruması', value: getStatus(s.kickProtection), inline: true },
            { name: 'Eylem Limitleri', value: getStatus(s.actionLimits.enabled), inline: true },
            { name: 'Ban Limiti', value: s.actionLimits.banLimit.toString(), inline: true },
            { name: 'Kick Limiti', value: s.actionLimits.kickLimit.toString(), inline: true },
            { name: 'Cezalı Rolü', value: jailRole ? jailRole.toString() : 'Ayarlanmamış', inline: true },
        );

    const rows = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('toggle:banProtection').setLabel(`Ban Koruması: ${s.banProtection ? 'Kapat' : 'Aç'}`).setStyle(s.banProtection ? ButtonStyle.Danger : ButtonStyle.Success),
            new ButtonBuilder().setCustomId('toggle:kickProtection').setLabel(`Kick Koruması: ${s.kickProtection ? 'Kapat' : 'Aç'}`).setStyle(s.kickProtection ? ButtonStyle.Danger : ButtonStyle.Success),
            new ButtonBuilder().setCustomId('toggle:actionLimits_enabled').setLabel(`Eylem Limitleri: ${s.actionLimits.enabled ? 'Kapat' : 'Aç'}`).setStyle(s.actionLimits.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        ),
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('punishment_setting_value')
                .setPlaceholder('Değeri Değiştir')
                .addOptions([
                    { label: 'Ban Limiti', value: 'actionLimits_banLimit' },
                    { label: 'Kick Limiti', value: 'actionLimits_kickLimit' },
                ]),
        ),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu:main').setLabel('↩️ Ana Menüye Dön').setStyle(ButtonStyle.Secondary))
    ];

    await interaction.message.edit({ content: null, embeds: [embed], components: rows });
}

async function sendSpamSettings(interaction, config) {
    const s = config.settings.spam;
    const getStatus = (setting) => setting ? '✅ Açık' : '❌ Kapalı';

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('💬 Spam Ayarları')
        .setDescription(`Spam koruması şu anda **${getStatus(s.enabled)}**.`)
        .addFields(
            { name: 'Uyarı Sayısı', value: `
${s.warningCount}
 mesaj`, inline: true },
            { name: 'Zaman Aralığı', value: `
${s.interval / 1000}
 saniye`, inline: true },
        );

    const rows = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('toggle:spam_enabled').setLabel(`Spam Koruması: ${s.enabled ? 'Kapat' : 'Aç'}`).setStyle(s.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        ),
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('spam_setting_value')
                .setPlaceholder('Değeri Değiştir')
                .addOptions([
                    { label: 'Uyarı Sayısı', value: 'spam_warningCount' },
                    { label: 'Zaman Aralığı (ms)', value: 'spam_interval' },
                ]),
        ),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu:main').setLabel('↩️ Ana Menüye Dön').setStyle(ButtonStyle.Secondary))
    ];

    await interaction.message.edit({ content: null, embeds: [embed], components: rows });
}

async function sendRaidSettings(interaction, config) {
    const s = config.settings.raid;
    const getStatus = (setting) => setting ? '✅ Açık' : '❌ Kapalı';

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('⚔️ Raid Ayarları')
        .setDescription(`Raid koruması şu anda **${getStatus(s.enabled)}**.`)
        .addFields(
            { name: 'Kullanıcı Sayısı', value: `
${s.userCount}
 kişi`, inline: true },
            { name: 'Zaman Aralığı', value: `
${s.time / 1000}
 saniye`, inline: true },
        );

    const rows = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('toggle:raid_enabled').setLabel(`Raid Koruması: ${s.enabled ? 'Kapat' : 'Aç'}`).setStyle(s.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        ),
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('raid_setting_value')
                .setPlaceholder('Değeri Değiştir')
                .addOptions([
                    { label: 'Kullanıcı Sayısı', value: 'raid_userCount' },
                    { label: 'Zaman Aralığı (ms)', value: 'raid_time' },
                ]),
        ),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu:main').setLabel('↩️ Ana Menüye Dön').setStyle(ButtonStyle.Secondary))
    ];

    await interaction.message.edit({ content: null, embeds: [embed], components: rows });
}

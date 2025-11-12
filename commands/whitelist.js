const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');


function getConfig() {
    const configPath = path.resolve(__dirname, '../config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function saveConfig(config) {
    const configPath = path.resolve(__dirname, '../config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

async function sendLog(guild, message) {
    const config = getConfig();
    const logChannel = guild.channels.cache.get(config.logChannel);
    if (logChannel) {
        if (typeof message === 'string') {
            await logChannel.send({ content: message });
        } else {
            await logChannel.send({ embeds: [message] });
        }
    }
}

module.exports = {
    name: 'whitelist',
    description: 'Whitelist\'e kullanıcı ekler, kaldırır veya listeler.',
    async execute(message, args) {
        if (message.author.id !== message.guild.ownerId) {
            return message.reply({ content: 'Bu komutu kullanmak için sunucu sahibi olmalısınız.' }).catch(() => {
                message.channel.send('Bu komutu kullanmak için sunucu sahibi olmalısınız.');
            });
        }

        const action = args[0]?.toLowerCase();

        if (!action || !['add', 'remove', 'list'].includes(action)) {
            const usageEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('Whitelist Komut Kullanımı')
                .setDescription('Whitelist\'e kullanıcı eklemek, çıkarmak veya listelemek için kullanılır.')
                .addFields(
                    { name: 'Ekleme', value: `\`${getConfig().prefix}whitelist add <@kullanıcı/ID>\`` },
                    { name: 'Çıkarma', value: `\`${getConfig().prefix}whitelist remove <@kullanıcı/ID>\`` },
                    { name: 'Listeleme', value: `\`${getConfig().prefix}whitelist list\`` }
                );
            return message.reply({ embeds: [usageEmbed] }).catch(() => {
                message.channel.send({ embeds: [usageEmbed] });
            });
        }

        const config = getConfig();

        if (action === 'list') {
            const whitelistUsers = await Promise.all(config.whitelist.map(async id => {
                try {
                    const user = await message.client.users.fetch(id);
                    return `• ${user.tag} (\`${id}\`)`;
                } catch {
                    return `• Bilinmeyen Kullanıcı (\`${id}\`)`;
                }
            }));

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('📜 Whitelist\'teki Kullanıcılar')
                .setDescription(whitelistUsers.length > 0 ? whitelistUsers.join('\n') : 'Whitelist\'te hiç kullanıcı yok.')
                .setFooter({ text: `Toplam ${whitelistUsers.length} kullanıcı` });

            return message.channel.send({ embeds: [embed] });
        }

        const targetArg = args[1];
        if (!targetArg) {
            return message.reply({ content: `Lütfen bir kullanıcı ID'si veya etiketi belirtin. Örnek: \`${config.prefix}whitelist ${action} <@kullanıcı/ID>\`` }).catch(() => {
                message.channel.send(`Lütfen bir kullanıcı ID'si veya etiketi belirtin. Örnek: \`${config.prefix}whitelist ${action} <@kullanıcı/ID>\``);
            });
        }

        const userId = targetArg.match(/^<@!?(\d+)>$/)?.[1] || targetArg;
        const user = await message.client.users.fetch(userId).catch(() => null);

        if (!user) {
            return message.reply({ content: 'Geçersiz kullanıcı ID\'si veya etiket. Kullanıcı bulunamadı.' }).catch(() => {
                message.channel.send('Geçersiz kullanıcı ID\'si veya etiket. Kullanıcı bulunamadı.');
            });
        }

        if (action === 'add') {
            if (config.whitelist.includes(user.id)) {
                return message.reply({ content: `**${user.tag}** zaten whitelist'te.` }).catch(() => {
                    message.channel.send(`**${user.tag}** zaten whitelist'te.`);
                });
            }
            config.whitelist.push(user.id);
            saveConfig(config);

            const logEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('Whitelist Ekleme İşlemi')
                .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
                .addFields(
                    { name: 'Eklenen Kullanıcı', value: `${user.tag} (\`${user.id}\`)`, inline: false },
                    { name: 'İşlemi Yapan Yetkili', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: false }
                )
                .setTimestamp();
            await sendLog(message.guild, logEmbed);

            const replyEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Whitelist\'e Eklendi')
                .setDescription(`**${user.tag}** başarıyla beyaz listeye eklendi.`)
                .addFields(
                    { name: 'Kullanıcı', value: `${user.tag}\n(\`${user.id}\`)`, inline: true },
                    { name: 'Ekleyen', value: `${message.author.tag}`, inline: true }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            message.reply({ embeds: [replyEmbed] }).catch(() => {
                message.channel.send({ embeds: [replyEmbed] });
            });

        } else if (action === 'remove') {
            if (user.id === message.guild.ownerId) {
                return message.reply({ content: 'Sunucu sahibini whitelist\'ten çıkaramazsınız.' }).catch(() => {
                    message.channel.send('Sunucu sahibini whitelist\'ten çıkaramazsınız.');
                });
            }
            if (user.id === message.client.user.id) {
                await sendLog(message.guild, `❌ Whitelist'ten Çıkarılamaz \nKullanıcı: ${user.tag} (${user.id})\nİşlemi Yapan: ${message.author.tag}`);
                return message.reply({ content: 'Botu whitelist\'ten çıkaramazsınız.' }).catch(() => {
                    message.channel.send('Botu whitelist\'ten çıkaramazsınız.');
                });
            }
            const index = config.whitelist.indexOf(user.id);
            if (index === -1) {
                return message.reply({ content: `**${user.tag}** whitelist'te değil.` }).catch(() => {
                    message.channel.send(`**${user.tag}** whitelist'te değil.`);
                });
            }
            config.whitelist.splice(index, 1);
            saveConfig(config);

            const logEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('Whitelist Çıkarma İşlemi')
                .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
                .addFields(
                    { name: 'Çıkarılan Kullanıcı', value: `${user.tag} (\`${user.id}\`)`, inline: false },
                    { name: 'İşlemi Yapan Yetkili', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: false }
                )
                .setTimestamp();
            await sendLog(message.guild, logEmbed);

            const replyEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ Whitelist\'ten Çıkarıldı')
                .setDescription(`**${user.tag}** başarıyla beyaz listeden çıkarıldı.`)
                .addFields(
                    { name: 'Kullanıcı', value: `${user.tag}\n(\`${user.id}\`)`, inline: true },
                    { name: 'Çıkaran', value: `${message.author.tag}`, inline: true }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            message.reply({ embeds: [replyEmbed] }).catch(() => {
                message.channel.send({ embeds: [replyEmbed] });
            });
        }
    },
}

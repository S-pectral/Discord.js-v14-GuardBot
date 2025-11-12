const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        const { getConfig, sendLog } = client;
        if (message.author.bot) return;
        const { prefix, whitelist, settings, linkAllowedChannels, linkAllowedRoles } = getConfig();

        if (settings.spam.enabled && !whitelist.includes(message.author.id)) {
            const now = Date.now();
            const user = client.userMessages.get(message.author.id);

            if (user) {
                const msgCount = user.msgCount;
                const time = user.time;

                if (now - time < settings.spam.interval) {
                    if (msgCount + 1 >= settings.spam.warningCount) {
                        message.delete();
                        message.channel.send(`${message.author}, çok hızlı mesaj gönderiyorsun! Lütfen yavaşla.`).then(msg => {
                            setTimeout(() => msg.delete(), 5000);
                        });
                    } else {
                        user.msgCount++;
                    }
                } else {
                    user.msgCount = 1;
                    user.time = now;
                }
            } else {
                client.userMessages.set(message.author.id, { msgCount: 1, time: now });
            }
        }

        if (settings.profanityFilter.enabled && !whitelist.includes(message.author.id)) {
            const bannedWords = settings.profanityFilter.bannedWords;
            const hasBannedWord = bannedWords.some(word => message.content.toLowerCase().includes(word.toLowerCase()));
        
            if (hasBannedWord) {
                message.delete().catch(() => {});
                const profanity = bannedWords.find(word => message.content.toLowerCase().includes(word.toLowerCase()));
                const logEmbed = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setTitle('💬 Yasaklı Kelime Tespit Edildi')
                    .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
                    .setDescription(`**${message.author.tag}** tarafından gönderilen ve yasaklı kelime içeren bir mesaj silindi.`)
                    .addFields(
                        { name: 'Kullanıcı', value: `${message.author.tag} (\`${message.author.id}\`)\n\`\`\`${profanity}\`\`\``, inline: true },
                        { name: 'Kanal', value: `${message.channel}`, inline: true },
                        { name: 'Silinen Mesaj', value: `\`\`\`${message.content}\`\`\`` }
                    )
                    .setThumbnail(message.author.displayAvatarURL())
                    .setTimestamp();
                sendLog(message.guild, logEmbed);
                message.channel.send(`${message.author}, bu sunucuda argo veya küfürlü dil kullanamazsınız!`).then(msg => {
                    setTimeout(() => msg.delete(), 5000);
                });
                return;
            }
        }

        const memberHasAllowedRole = message.member && message.member.roles.cache.some(role => linkAllowedRoles.includes(role.id));

        if (settings.link && !whitelist.includes(message.author.id) && !linkAllowedChannels.includes(message.channel.id) && !memberHasAllowedRole) {
            const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
           const gifRegex = /https?:\/\/.*(giphy\.com|tenor\.com)\/.*|https?:\/\/.*\.gif/i;
            const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[^\s]+/i;


            if ((linkRegex.test(message.content) && !gifRegex.test(message.content)) || inviteRegex.test(message.content)) {
                message.delete().catch(() => {});
                const link = message.content.match(linkRegex)?.[0] || message.content.match(inviteRegex)?.[0] || 'Bulunamadı';
                const logEmbed = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setTitle('🔗  Yasaklı Link Tespit Edildi')
                    .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
                    .setDescription(`**${message.author.tag}** tarafından gönderilen ve yasaklı link içeren bir mesaj silindi.`)
                    .addFields(
                        { name: 'Kullanıcı', value: `${message.author.tag} (\`${message.author.id}\`)\n\`\`\`${link}\`\`\``, inline: true },
                        { name: 'Kanal', value: `${message.channel}`, inline: true },
                        { name: 'Silinen Mesaj', value: `\`\`\`${message.content}\`\`\`` }
                    )
                    .setThumbnail(message.author.displayAvatarURL())
                    .setTimestamp();
                sendLog(message.guild, logEmbed);
                message.channel.send(`${message.author}, bu sunucuda link paylaşamazsınız!`).then(msg => {
                    setTimeout(() => msg.delete(), 5000);
                });
                return;
            }
        }

        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command || command.data) return;

        try {
            command.execute(message, args);
        } catch (error) {
            console.error(error);
            message.reply('Bu komutu çalıştırırken bir hata oluştu!');
        }
    },
};

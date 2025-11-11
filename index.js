const { Client, GatewayIntentBits, Collection, AuditLogEvent, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildWebhooks,
	],
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

const userMessages = new Map();
let raidMode = false;
const recentJoins = [];

function getConfig() {
    const configPath = path.resolve(__dirname, './config.json');
    const config = JSON.parse(fs.readFileSync(configPath));
    config.whitelist = config.whitelist.map(id => String(id));
    config.linkAllowedChannels = config.linkAllowedChannels.map(id => String(id));
    config.linkAllowedRoles = config.linkAllowedRoles.map(id => String(id));
    config.settings.jailRoleId = String(config.settings.jailRoleId);
    return config;
}

client.once('ready', () => {
	console.log('Bot hazır!');
});

client.on('messageCreate', message => {
    if (message.author.bot) return;
    const { prefix, whitelist, settings } = getConfig();

   
    if (settings.spam.enabled && !whitelist.includes(message.author.id)) {
        const now = Date.now();
        const user = userMessages.get(message.author.id);

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
            userMessages.set(message.author.id, { msgCount: 1, time: now });
        }
    }

  
    if (settings.profanityFilter.enabled && !whitelist.includes(message.author.id)) {
        const bannedWords = settings.profanityFilter.bannedWords;
        const hasBannedWord = bannedWords.some(word => message.content.toLowerCase().includes(word.toLowerCase()));

        if (hasBannedWord) {
            message.delete().catch(() => {}); 
            sendLog(message.guild, `:no_entry_sign: ${message.author.tag} tarafından gönderilen küfür içeren mesaj silindi: ||${message.content}||`);
            message.channel.send(`${message.author}, bu sunucuda argo veya küfürlü dil kullanamazsınız!`).then(msg => {
                setTimeout(() => msg.delete(), 5000);
            });
            return; 
        }
    }

 
    const { linkAllowedChannels, linkAllowedRoles } = getConfig();
    const memberHasAllowedRole = message.member && message.member.roles.cache.some(role => linkAllowedRoles.includes(role.id));

    if (settings.link && !whitelist.includes(message.author.id) && !linkAllowedChannels.includes(message.channel.id) && !memberHasAllowedRole) {
        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
        const gifRegex = /https?:\/\/.*(giphy\.com|tenor\.com)\/.*|https?:\/\/.*\.gif/i;
        const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[^\s]+/i;


        if ((linkRegex.test(message.content) && !gifRegex.test(message.content)) || inviteRegex.test(message.content)) {
            message.delete().catch(() => {});
            sendLog(message.guild, `${message.author.tag} tarafından gönderilen link içeren mesaj silindi: ${message.content}`);
            message.channel.send(`${message.author}, bu sunucuda link paylaşamazsınız!`).then(msg => {
                setTimeout(() => msg.delete(), 5000);
            });
            return;
        }
    }

	if (!message.content.startsWith(prefix)) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	if (!client.commands.has(commandName)) return;

	const command = client.commands.get(commandName);

	try {
		command.execute(message, args);
	} catch (error) {
		console.error(error);
		message.reply('Bu komutu çalıştırırken bir hata oluştu!');
	}
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const command = client.commands.get('ayarlar');
    if(command && typeof command.handleInteraction === 'function') {
        await command.handleInteraction(interaction);
    }

});

async function sendLog(guild, message) {
    const { logChannel } = getConfig();
    const channel = guild.channels.cache.get(logChannel);
    if (channel) {
        if (typeof message === 'string') {
            await channel.send({ content: message });
        } else {
            await channel.send({ embeds: [message] });
        }
    }
}

async function handleProtection(guild, eventType, action, condition, logMessage, revertAction) {
    const { whitelist, settings } = getConfig();
    if (!condition) return;

    const fetchedLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: eventType,
    });
    const log = fetchedLogs.entries.first();
    if (!log) return;

    const { executor } = log;
    if (executor.id === client.user.id) return;
    if (!whitelist.includes(executor.id)) {
         await revertAction();
        const memberToJail = await guild.members.fetch(executor.id).catch(() => null);
        if (memberToJail) {
            await jailUser(guild, memberToJail, executor, logMessage);
        } else {
            sendLog(guild, `:x: **${executor.tag}** (\`${executor.id}\`) kullanıcısı yetkisiz işlem yapmaya çalıştı. Kullanıcı sunucuda bulunamadı. \`${logMessage}\``);
        }
    }
}


async function jailUser(guild, memberToJail, executor, logMessage, eventType) {
    const config = getConfig();
    const rolesToRemove = memberToJail.roles.cache.filter(role => role.id !== guild.id && !role.managed).map(role => role.id);

    try {
        if (rolesToRemove.length > 0) {
            await memberToJail.roles.remove(rolesToRemove, '[Guard] Yetkisiz işlem nedeniyle roller alındı.');
        }
        const jailRole = guild.roles.cache.get(config.settings.jailRoleId); 
        if (jailRole) {
            await memberToJail.roles.add(jailRole, '[Guard] Yetkisiz işlem nedeniyle cezalı rolü verildi.');
        }

        const logEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🚨 Yetkisiz İşlem Tespit Edildi')
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
            .setDescription(`**${executor.tag}** tarafından yapılan yetkisiz işlem geri alındı ve kullanıcı cezalandırıldı.`)
            .addFields(
                { name: 'İşlemi Yapan', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
                { name: 'Yapılan İşlem', value: `\`${logMessage}\``, inline: true },
                { name: 'Sonuç', value: jailRoleMessage, inline: false }
            )
            .setThumbnail(executor.displayAvatarURL())
            .setTimestamp();

        await sendLog(guild, logEmbed);
    } catch (error) {
        console.error('Rolleri alırken veya cezalı rolü verirken hata oluştu:', error);
        sendLog(guild, `:x: **${executor.tag}** (\`${executor.id}\`) kullanıcısı yetkisiz işlem yapmaya çalıştı. Rolleri alırken veya cezalı rolü verirken hata oluştu! \`${logMessage}\``);
    }
}

client.on('channelCreate', async channel => {
    await handleProtection(channel.guild, AuditLogEvent.ChannelCreate, 'channel_create', getConfig().settings.channel.create, `Yetkisiz kanal oluşturuldu: ${channel.name}`, () => channel.delete());
});

client.on('channelDelete', async channel => {
    await handleProtection(channel.guild, AuditLogEvent.ChannelDelete, 'channel_delete', getConfig().settings.channel.delete, `Yetkisiz kanal silindi: ${channel.name}`, () => channel.clone());
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
    await handleProtection(newChannel.guild, AuditLogEvent.ChannelUpdate, 'channel_update', getConfig().settings.channel.update, `Yetkisiz kanal güncellendi: ${newChannel.name}`, () => {
        newChannel.edit({
            name: oldChannel.name,
            type: oldChannel.type,
            position: oldChannel.rawPosition,
            topic: oldChannel.topic,
            nsfw: oldChannel.nsfw,
            parent: oldChannel.parent,
            permissionOverwrites: oldChannel.permissionOverwrites.cache,
            bitrate: oldChannel.bitrate,
            userLimit: oldChannel.userLimit,
            rateLimitPerUser: oldChannel.rateLimitPerUser,
            rtcRegion: oldChannel.rtcRegion,
            videoQualityMode: oldChannel.videoQualityMode,
            defaultAutoArchiveDuration: oldChannel.defaultAutoArchiveDuration,
        });
    });
});

client.on('roleCreate', async role => {
    await handleProtection(role.guild, AuditLogEvent.RoleCreate, 'role_create', getConfig().settings.role.create, `Yetkisiz rol oluşturuldu: ${role.name}`, () => role.delete());
});

client.on('roleDelete', async role => {
    await handleProtection(role.guild, AuditLogEvent.RoleDelete, 'role_delete', getConfig().settings.role.delete, `Yetkisiz rol silindi: ${role.name}`, async () => {
        const newRole = await role.guild.roles.create({
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            permissions: role.permissions,
            mentionable: role.mentionable,
        });
        await newRole.setPosition(role.rawPosition);
    });
});

client.on('roleUpdate', async (oldRole, newRole) => {
    await handleProtection(newRole.guild, AuditLogEvent.RoleUpdate, 'role_update', getConfig().settings.role.update, `Yetkisiz rol güncellendi: ${newRole.name}`, () => newRole.edit({
        name: oldRole.name,
        color: oldRole.color,
        hoist: oldRole.hoist,
        permissions: oldRole.permissions,
        mentionable: oldRole.mentionable,
    }));
});

client.on('guildBanAdd', async ban => {
    const config = getConfig();
    const fetchedLogs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanAdd,
    });
    const banLog = fetchedLogs.entries.first();
    if (!banLog) return;

    const { executor, target, reason } = banLog;
    if (target.id !== ban.user.id) return;

    const logEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('Kullanıcı Yasaklandı')
        .addFields(
            { name: 'Yasaklanan Kullanıcı', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: false },
            { name: 'Yasaklayan Yetkili', value: `${executor.tag} (\`${executor.id}\`)`, inline: false },
            { name: 'Sebep', value: reason || 'Belirtilmemiş', inline: false }
        )
        .setTimestamp();
    await sendLog(ban.guild, logEmbed);

    await handleProtection(ban.guild, AuditLogEvent.MemberBanAdd, 'ban', config.settings.banProtection, `Yetkisiz ban atıldı: ${ban.user.tag}`, () => ban.guild.members.unban(ban.user), AuditLogEvent.MemberBanAdd);
});

client.on('guildMemberRemove', async member => {
    const config = getConfig();
    const { kickProtection } = config.settings;
    if (!kickProtection) return;

    const fetchedLogs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick,
    });
    const kickLog = fetchedLogs.entries.first();
    if (!kickLog) return; 

    const { executor, target } = kickLog;
    if (target.id === member.id) {
        if (executor.id === client.user.id) return; 

        const logEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('Kullanıcı Atıldı')
            .addFields(
                { name: 'Atılan Kullanıcı', value: `${member.user.tag} (\`${member.id}\`)`, inline: false },
                { name: 'Atan Yetkili', value: `${executor.tag} (\`${executor.id}\`)`, inline: false },
                { name: 'Sebep', value: kickLog.reason || 'Belirtilmemiş', inline: false }
            )
            .setTimestamp();
        await sendLog(member.guild, logEmbed);

        if (!config.whitelist.includes(executor.id)) {
            const memberToJail = await member.guild.members.fetch(executor.id).catch(() => null);
            if (memberToJail) {
                await jailUser(member.guild, memberToJail, executor, `Yetkisiz kick attı: ${member.user.tag}`);
            } else {
                sendLog(member.guild, `:x: **${executor.tag}** (\`${executor.id}\`) kullanıcısı yetkisiz kick atmaya çalıştı. Kullanıcı sunucuda bulunamadı. Atılan kişi: ${member.user.tag}`);
            }
        }
    }
});

client.on('webhookUpdate', async (channel) => {
    const { webhook } = getConfig().settings;
    if (!webhook) return;

    const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.WebhookCreate,
    });
    const webhookLog = fetchedLogs.entries.first();
    if (!webhookLog) return;

    const { executor } = webhookLog;
    const { whitelist } = getConfig();
    if (!whitelist.includes(executor.id)) {
        const webhooks = await channel.fetchWebhooks();
        const createdWebhook = webhooks.find(wh => wh.id === webhookLog.target.id);
        if (createdWebhook) {
            await createdWebhook.delete();
            sendLog(channel.guild, `Yetkisiz webhook oluşturuldu: ${executor.tag} tarafından oluşturulan webhook silindi.`);
        }
    }
});

client.on('guildMemberAdd', member => {
    const { raid } = getConfig().settings;
    if (!raid.enabled) return;

    if (raidMode) {
        member.kick('Sunucu şu anda raid modunda.');
        sendLog(member.guild, `Raid modunda olduğu için ${member.user.tag} atıldı.`);
        return;
    }

    const now = Date.now();
    recentJoins.push(now);

    const recentJoinCount = recentJoins.filter(time => now - time < raid.time).length;

    if (recentJoinCount >= raid.userCount) {
        raidMode = true;
        sendLog(member.guild, `Raid algılandı! Raid modu etkinleştirildi.`);
        setTimeout(() => {
            raidMode = false;
            sendLog(member.guild, `Raid modu devre dışı bırakıldı.`);
        }, 60000);
    }
});

const { token } = getConfig();
client.login(token);
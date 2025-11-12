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
   const filePath = path.join(__dirname, 'commands', file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        // Slash komutu
        client.commands.set(command.data.name, command);
    } else if ('name' in command && 'execute' in command) {
        // Prefix komutu
        client.commands.set(command.name, command);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args, client));
	} else {
		client.on(event.name, (...args) => event.execute(...args, client));
	}
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

client.userMessages = userMessages;
client.raidMode = raidMode;
client.getConfig = getConfig;

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command || !command.data) { // Sadece slash komutlarını çalıştır
        console.error(`${interaction.commandName} adında bir slash komutu bulunamadı.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Bu komutu çalıştırırken bir hata oluştu!', ephemeral: true });
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
        let jailRoleMessage = 'Tüm rolleri alındı';
        if (rolesToRemove.length > 0) {
            await memberToJail.roles.remove(rolesToRemove, '[Guard] Yetkisiz işlem nedeniyle roller alındı.');
        }
        const jailRole = guild.roles.cache.get(config.settings.jailRoleId); 
        if (jailRole) {
            await memberToJail.roles.add(jailRole, '[Guard] Yetkisiz işlem nedeniyle cezalı rolü verildi.');
            jailRoleMessage += ` ve <@&${jailRole.id}> rolü verildi.`;
        } else {
            jailRoleMessage += '\n❌ Cezalı rolü bulunamadığı için atanamadı.';
        }

        const logEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🚨 Yetkisiz İşlem Tespit Edildi')
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
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
        sendLog(guild, `❌ **${executor.tag}** (\`${executor.id}\`) kullanıcısı yetkisiz işlem yapmaya çalıştı. Rolleri alırken veya cezalı rolü verirken hata oluştu! \`${logMessage}\``);
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

client.sendLog = sendLog;

const { token } = getConfig();
client.login(token);
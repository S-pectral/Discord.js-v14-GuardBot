module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const { getConfig, sendLog } = client;
        const { raid } = getConfig().settings;
        if (!raid.enabled) return;

        if (client.raidMode) {
            member.kick('Sunucu şu anda raid modunda.');
            sendLog(member.guild, `Raid modunda olduğu için ${member.user.tag} atıldı.`);
            return;
        }

        const now = Date.now();
        client.recentJoins.push(now);

        const recentJoinCount = client.recentJoins.filter(time => now - time < raid.time).length;

        if (recentJoinCount >= raid.userCount) {
            client.raidMode = true;
            sendLog(member.guild, `Raid algılandı! Raid modu etkinleştirildi.`);
            setTimeout(() => {
                client.raidMode = false;
                sendLog(member.guild, `Raid modu devre dışı bırakıldı.`);
            }, 60000);
        }
    },
};

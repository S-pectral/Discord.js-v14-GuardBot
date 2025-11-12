const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');

// config.json dosyasından gerekli bilgileri oku
const configPath = path.resolve(__dirname, './config.json');
const { clientId, guildId, token } = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('Komutlar taranıyor...');

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Sadece slash komutlarını (data özelliğine sahip olanları) al
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[+] ${command.data.name} komutu bulundu.`);
    } else {
        console.log(`[-] ${file} bir slash komutu değil, atlanıyor.`);
    }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`\n${commands.length} adet (/) komutunun yenilenmesi başlatıldı.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`\nBaşarıyla ${data.length} adet (/) komutu sunucuya kaydedildi.`);
    } catch (error) {
        console.error('\nKomutlar kaydedilirken bir hata oluştu:', error);
    }
})();
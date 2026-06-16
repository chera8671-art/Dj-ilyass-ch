const Discord = require('discord.js');
const client = new Discord.Client();
client.on('message', msg => {
    if (msg.content === '!play') {
        // إرسال إشارة عبر WebSocket لتشغيل الأغنية
    }
});
client.login('TOKEN');

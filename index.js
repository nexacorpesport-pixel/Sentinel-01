const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus 
} = require('@discordjs/voice');
const path = require('path');
const express = require('express'); // 👈 Ajout d'Express

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// ======================================================
// SERVEUR WEB (PORT 3000) POUR LE PING H24
// ======================================================
const app = express();
const PORT = process.env.PORT || 3000;

// Cette route renvoie "OK" quand le service de ping (ex: UptimeRobot) appelle le bot
app.get('/', (req, res) => {
    res.send('Sentinel Bot est opérationnel H24 !');
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur Web actif sur le port ${PORT} (Prêt pour le ping)`);
});

// ======================================================
// CONFIGURATION ET LOGIQUE VOCALE
// ======================================================
const config = {
    voiceChannelId: "1501626014206394479",
    staffChannelId: "1525663532715085965"
};

let connection = null;
const player = createAudioPlayer();

function playReminder() {
    try {
        const resource = createAudioResource(path.join(__dirname, 'rappel.mp3'), {
            inlineVolume: true
        });
        player.play(resource);
        console.log("🔊 Diffusion du message de rappel de modération...");
    } catch (error) {
        console.error("Erreur lors de la lecture audio :", error);
    }
}

function connectToVoice() {
    const channel = client.channels.cache.get(config.voiceChannelId);
    if (!channel) return console.error("Salon vocal introuvable !");

    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfMute: false,
        selfDeaf: false 
    });

    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
        } catch (error) {
            console.log("Reconnexion au salon vocal en cours...");
            connectToVoice();
        }
    });
}

client.once('ready', () => {
    console.log(`🤖 ${client.user.tag} est en ligne !`);
    connectToVoice();
});

client.on('voiceStateUpdate', (oldState, newState) => {
    if (newState.channelId !== config.voiceChannelId) return;
    if (newState.member.id === client.user.id) return;

    const channel = newState.channel;
    if (!channel) return;

    const humanMembers = channel.members.filter(m => !m.user.bot);

    if (oldState.channelId !== config.voiceChannelId && humanMembers.size === 1) {
        console.log(`👤 ${newState.member.user.tag} a rejoint. Le bot était seul. Lancement du vocal.`);
        setTimeout(() => {
            playReminder();
        }, 1500);
    }
});

client.login(process.env.DISCORD_TOKEN);
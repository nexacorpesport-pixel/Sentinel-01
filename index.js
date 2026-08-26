const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const config = require('./config');

// --- 🛡️ ANTI-CRASH PUISSANT ---
process.on('uncaughtException', (err) => console.error('[ANTI-CRASH]', err));
process.on('unhandledRejection', (err) => console.error('[ANTI-CRASH]', err));

// --- 🌐 SERVEUR WEB (Render + UptimeRobot) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot Ranked en ligne 24/7 !'));
app.listen(PORT, () => console.log(`[HTTP] Serveur démarré sur le port ${PORT}`));

// --- 🤖 BOT DISCORD ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.once('ready', async () => {
  console.log(`[BOT] Connecté en tant que ${client.user.tag}`);

  // Connexion MongoDB Optionnelle (si l'URI est présente)
  if (config.mongoURI) {
    try {
      await mongoose.connect(config.mongoURI);
      console.log('[DATABASE] Connecté à MongoDB avec succès !');
    } catch (err) {
      console.error('[DATABASE] Erreur de connexion MongoDB :', err.message);
    }
  } else {
    console.log('[DATABASE] Aucune URI MongoDB fournie, le bot tourne sans BDD pour l moment.');
  }

  // Enregistrement des commandes Slash
  const commands = [
    { name: 'daily', description: 'Réclame tes 5 coins quotidiens' },
    { name: 'coins', description: 'Affiche ton solde de coins' },
    { name: 'profile', description: 'Affiche tes statistiques Ranked' },
    { name: 'setup-embeds', description: 'Déploie les messages d administration' }
  ];

  await client.application.commands.set(commands);
  console.log('[COMMANDS] Commandes Slash enregistrées !');
});

client.login(config.token);

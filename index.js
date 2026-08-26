const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, UserSelectMenuBuilder } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const config = require('./config.json');
const User = require('./models/User');

// --- 🛡️ SYSTEME ANTI-CRASH HYPER PUISSANT ---
process.on('uncaughtException', (error) => {
  console.error('[ANTI-CRASH] Exception non capturée :', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ANTI-CRASH] Rejet de promesse non géré :', reason);
});

// --- 🌐 SERVEUR WEB POUR RENDER & UPTIMEROBOT ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot Ranked 1v1 est en ligne 24/7 !');
});

app.listen(PORT, () => {
  console.log(`[HTTP] Serveur Web démarré sur le port ${PORT}`);
});

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

// Stockage en mémoire des files d'attente
const queues = {
  '1v1': [],
  '2v2': [],
  '3v3': []
};

client.once('ready', async () => {
  console.log(`[BOT] Connecté en tant que ${client.user.tag}`);
  
  // Connexion MongoDB
  try {
    await mongoose.connect(config.mongoURI);
    console.log('[DATABASE] Connecté à MongoDB avec succès !');
  } catch (err) {
    console.error('[DATABASE] Erreur de connexion MongoDB :', err);
  }

  // Enregistrement des commandes Slash
  const commands = [
    {
      name: 'daily',
      description: 'Réclame tes 5 coins quotidiens gratuits'
    },
    {
      name: 'coins',
      description: 'Affiche ton solde actuel de coins'
    },
    {
      name: 'profile',
      description: 'Affiche tes statistiques Ranked et ton profil'
    },
    {
      name: 'setup-embeds',
      description: 'Déploie les messages Embeds d administration (Info, Matchmaking, Tickets)'
    }
  ];

  await client.application.commands.set(commands);
  console.log('[COMMANDS] Commandes Slash enregistrées !');
});

// --- 🎮 GESTION DES COMMANDES SLASH ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Récupérer ou créer l'utilisateur
  let userData = await User.findOne({ userId: interaction.user.id });
  if (!userData) {
    userData = await User.create({ userId: interaction.user.id });
  }

  if (commandName === 'daily') {
    const now = new Date();
    const cooldown = 24 * 60 * 60 * 1000;

    if (userData.lastDaily && (now - userData.lastDaily) < cooldown) {
      const remainingTime = cooldown - (now - userData.lastDaily);
      const hours = Math.floor(remainingTime / (1000 * 60 * 60));
      const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
      
      return interaction.reply({ 
        content: `⏱️ Tu as déjà réclamé tes coins aujourd'hui ! Reviens dans **${hours}h ${minutes}m**.`, 
        ephemeral: true 
      });
    }

    userData.coins += 5;
    userData.lastDaily = now;
    await userData.save();

    const embed = new EmbedBuilder()
      .setTitle('💰 Récompense Quotidienne')
      .setDescription('Tu as reçu tes **5 coins** quotidiens ! Nouveau solde : **' + userData.coins + ' coins**.')
      .setColor(0xFFD700);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (commandName === 'coins') {
    const embed = new EmbedBuilder()
      .setTitle('🪙 Ton Solde de Coins')
      .setDescription(`Tu possèdes actuellement **${userData.coins} coins**.`)
      .setColor(0xFFD700);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (commandName === 'profile') {
    const totalMatches = userData.wins + userData.losses;
    const winrate = totalMatches > 0 ? ((userData.wins / totalMatches) * 100).toFixed(1) : 0;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Profil Ranked — ${interaction.user.username}`)
      .setColor(0xFFD700)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '🪙 Coins', value: `${userData.coins}`, inline: true },
        { name: '🏆 Elo / Points', value: `${userData.elo}`, inline: true },
        { name: '⚔️ Victoires', value: `${userData.wins}`, inline: true },
        { name: '💀 Défaites', value: `${userData.losses}`, inline: true },
        { name: '📈 Taux de victoire', value: `${winrate}%`, inline: true }
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (commandName === 'setup-embeds') {
    // Vérification des permissions
    const isStaff = config.roles.staff.some(roleId => interaction.member.roles.cache.has(roleId));
    if (!isStaff) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'exécuter cette commande.', ephemeral: true });
    }

    await setupEmbeds(client);
    return interaction.reply({ content: '✅ Embeds d\'information, matchmaking, tickets et leaderboard initialisés avec succès !', ephemeral: true });
  }
});

// --- 📌 FONCTION D'INITIALISATION DES EMBEDS ---
async function setupEmbeds(client) {
  // 1. EMBED RANKED INFO
  const infoChannel = await client.channels.fetch(config.channels.rankedInfo);
  if (infoChannel) {
    const embedInfo = new EmbedBuilder()
      .setTitle('🏆 REGLEMENT & SYSTEME RANKED 1V1')
      .setColor(0xFFD700)
      .setDescription(
        'Bienvenue dans le système officiel de Ranked 1v1 !\n\n' +
        '**👑 Fonctionnement Général :**\n' +
        '• Chaque joueur commence avec **10 coins** et **1000 Elo**.\n' +
        '• Les mises sont bloquées au lancement du match et redistribuées au vainqueur.\n' +
        '• Réclame tes **5 coins gratuits** chaque jour grâce à la commande `/daily`.\n\n' +
        '**📜 Commandes Utiles :**\n' +
        '`/daily` - Réclamer tes 5 coins quotidiens\n' +
        '`/coins` - Consulter ton solde\n' +
        '`/profile` - Consulter tes statistiques (V/D, Elo, Coins)\n\n' +
        '**⚠️ Fair-play & Règlements :**\n' +
        'Tout refus de jouer, triche ou tentative de dupe entraînera un ban définitif du système Ranked et une réinitialisation de vos coins.'
      )
      .setFooter({ text: 'Ranked System Premium • Developpé pour l excellence' });

    await infoChannel.send({ embeds: [embedInfo] });
  }

  // 2. EMBED MATCHMAKING
  const mmChannel = await client.channels.fetch(config.channels.rankedMatchmaking);
  if (mmChannel) {
    const embedMM = new EmbedBuilder()
      .setTitle('⚔️ SALLE DE MATCHMAKING')
      .setColor(0xFFD700)
      .setDescription(
        'Sélectionne le mode de jeu souhaité ci-dessous pour rejoindre la file d attente.\n\n' +
        '• **1v1** : Match individuel avec mise directe.\n' +
        '• **2v2** : Choisis ton coéquipier via le menu dédié.\n' +
        '• **3v3** : Match en équipe complet.\n\n' +
        'Clique sur **Quitter la file** pour annuler ta recherche à tout moment.'
      );

    const rowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('queue_1v1').setLabel('Rejoindre 1v1').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('queue_2v2').setLabel('Rejoindre 2v2').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('queue_3v3').setLabel('Rejoindre 3v3').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('leave_queue').setLabel('❌ Quitter la file').setStyle(ButtonStyle.Danger)
    );

    await mmChannel.send({ embeds: [embedMM], components: [rowButtons] });
  }

  // 3. EMBED SUPPORT TICKETS
  const ticketChannel = await client.channels.fetch(config.channels.supportTickets);
  if (ticketChannel) {
    const embedTicket = new EmbedBuilder()
      .setTitle('🎫 SUPPORT & ASSISTANCE RANKED')
      .setColor(0xFFD700)
      .setDescription('Un problème lors d un match ? Une question ou un litige ?\n\nClique sur le bouton ci-dessous pour ouvrir un ticket privé avec l équipe du Staff.');

    const rowTicket = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_ticket').setLabel('📩 Ouvrir un Ticket').setStyle(ButtonStyle.Secondary)
    );

    await ticketChannel.send({ embeds: [embedTicket], components: [rowTicket] });
  }

  // 4. LEADERBOARD DYNAMIQUE (AVEC PAGINATION)
  await updateLeaderboard(client);
}

// --- 📊 SYSTEME DE LEADERBOARD DYNAMIQUE A PAGINATION ---
async function updateLeaderboard(client, page = 1) {
  const channel = await client.channels.fetch(config.channels.leaderboard);
  if (!channel) return;

  const limit = 10;
  const totalUsers = await User.countDocuments();
  const totalPages = Math.ceil(totalUsers / limit) || 1;

  page = Math.max(1, Math.min(page, totalPages));

  const topUsers = await User.find()
    .sort({ elo: -1, coins: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  let description = 'Voici le classement général des meilleurs joueurs du serveur :\n\n';

  if (topUsers.length === 0) {
    description += '*Aucun joueur enregistré pour le moment.*';
  } else {
    topUsers.forEach((u, index) => {
      const rank = (page - 1) * limit + index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**#${rank}**`;
      description += `${medal} <@${u.userId}> — **${u.elo} pts** | **${u.coins} coins** (${u.wins}V / ${u.losses}D)\n`;
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 CLASSEMENT GENERAL RANKED')
    .setColor(0xFFD700)
    .setDescription(description)
    .setFooter({ text: `Page ${page} / ${totalPages} • Mis à jour automatiquement` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lb_prev_${page}`).setLabel('⬅️ Précédent').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
    new ButtonBuilder().setCustomId(`lb_next_${page}`).setLabel('Suivant ➡️').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages)
  );

  // Chercher si un message d'embed existe déjà pour le mettre à jour
  const messages = await channel.messages.fetch({ limit: 5 });
  const existingMsg = messages.find(m => m.author.id === client.user.id);

  if (existingMsg) {
    await existingMsg.edit({ embeds: [embed], components: [row] });
  } else {
    await channel.send({ embeds: [embed], components: [row] });
  }
}

// --- 🔘 GESTION DES INTERACTIONS (BOUTONS & MENUS) ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() && !interaction.isUserSelectMenu()) return;

  const { customId, user, guild } = interaction;

  // --- PAGINATION DU LEADERBOARD ---
  if (customId.startsWith('lb_prev_') || customId.startsWith('lb_next_')) {
    const currentPage = parseInt(customId.split('_')[2]);
    const newPage = customId.startsWith('lb_prev_') ? currentPage - 1 : currentPage + 1;
    await interaction.deferUpdate();
    return updateLeaderboard(client, newPage);
  }

  // --- GESTION DE LA FILE 1V1 ---
  if (customId === 'queue_1v1') {
    if (queues['1v1'].includes(user.id)) {
      return interaction.reply({ content: '⚠️ Tu es déjà dans la file d attente 1v1 !', ephemeral: true });
    }

    queues['1v1'].push(user.id);
    await interaction.reply({ content: '✅ Tu as rejoint la file d attente **1v1** !', ephemeral: true });

    // Si deux joueurs sont dans la file
    if (queues['1v1'].length >= 2) {
      const player1Id = queues['1v1'].shift();
      const player2Id = queues['1v1'].shift();
      createMatchChannel(guild, [player1Id, player2Id], '1v1');
    }
  }

  // --- ANNULATION DE FILE ---
  if (customId === 'leave_queue') {
    let found = false;
    for (const mode in queues) {
      const index = queues[mode].indexOf(user.id);
      if (index !== -1) {
        queues[mode].splice(index, 1);
        found = true;
      }
    }

    if (found) {
      return interaction.reply({ content: '❌ Tu as été retiré de toutes les files d attente.', ephemeral: true });
    } else {
      return interaction.reply({ content: '⚠️ Tu n es dans aucune file d attente.', ephemeral: true });
    }
  }

  // --- TICKETS SUPPORT ---
  if (customId === 'open_ticket') {
    const ticketChannelName = `ticket-${user.username}`.toLowerCase();
    
    // Création du salon dans la catégorie Ticket
    const ticketChan = await guild.channels.create({
      name: ticketChannelName,
      parent: config.categories.tickets,
      permissionOverwrites: [
        { id: guild.id, deny: ['ViewChannel'] },
        { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        ...config.roles.staff.map(rId => ({ id: rId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }))
      ]
    });

    const embedTicketChan = new EmbedBuilder()
      .setTitle(`🎫 Ticket Support — ${user.username}`)
      .setColor(0xFFD700)
      .setDescription('Bienvenue dans ton ticket support. L équipe du staff va prendre en charge ta demande dans les plus brefs délais.')
      .setFooter({ text: 'Utilise les boutons ci-dessous pour gérer ce ticket' });

    const rowChan = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger)
    );

    await ticketChan.send({ embeds: [embedTicketChan], components: [rowChan] });
    return interaction.reply({ content: `✅ Ton ticket a été créé dans <#${ticketChan.id}>.`, ephemeral: true });
  }

  if (customId === 'close_ticket') {
    await interaction.reply('🔒 Fermeture du ticket dans 5 secondes...');
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  }
});

// --- ⚔️ CREATION DU SALON DE MATCH RANKED ---
async function createMatchChannel(guild, players, mode) {
  const p1 = await guild.members.fetch(players[0]);
  const p2 = await guild.members.fetch(players[1]);

  const matchChannel = await guild.channels.create({
    name: `match-${mode}-${p1.user.username}-vs-${p2.user.username}`,
    parent: config.categories.ranked,
    permissionOverwrites: [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: p1.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: p2.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      ...config.roles.staff.map(rId => ({ id: rId, allow: ['ViewChannel', 'SendMessages'] }))
    ]
  });

  const matchEmbed = new EmbedBuilder()
    .setTitle(`⚔️ MATCH RANKED ${mode.toUpperCase()} LANCE !`)
    .setColor(0xFFD700)
    .setDescription(
      `**Joueurs :** <@${p1.id}> vs <@${p2.id}>\n\n` +
      'Mettez-vous d accord sur le salon puis une fois le match terminé, cliquez sur votre résultat.\n' +
      'En cas de désaccord ou de problème, cliquez sur **Appeler Staff**.'
    );

  const rowMatch = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`win_${p1.id}_${p2.id}`).setLabel('🏆 J ai Gagné').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`call_staff`).setLabel('🚨 Appeler Staff').setStyle(ButtonStyle.Danger)
  );

  await matchChannel.send({ content: `<@${p1.id}> <@${p2.id}>`, embeds: [matchEmbed], components: [rowMatch] });
}

client.login(config.token);

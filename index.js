// ======================================================
// Sentinel-01 v2
// Gardien vocal Discord
// Partie 1/x
// ======================================================

require("dotenv").config();

const config = require("./config.json");

const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    Events,
    ActivityType
} = require("discord.js");

const {
    joinVoiceChannel,
    getVoiceConnection
} = require("@discordjs/voice");

const sqlite3 = require("sqlite3").verbose();
const path = require("path");


// ======================================================
// CONFIGURATION
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;

const VOICE_CHANNEL_ID = config.voiceChannelId;
const STAFF_CHANNEL_ID = config.staffChannelId;


// ======================================================
// CLIENT DISCORD
// ======================================================

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMembers,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.MessageContent,

        GatewayIntentBits.GuildVoiceStates

    ],

    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User
    ]

});


// ======================================================
// COLLECTIONS
// ======================================================

client.commands = new Collection();


// Historique vocal temporaire
client.voiceSessions = new Map();


// Anti spam vocal
client.voiceActivity = new Map();


// ======================================================
// DATABASE SQLITE
// ======================================================

const db = new sqlite3.Database(
    path.join(__dirname, "sentinel.db"),
    (err) => {

        if (err) {
            console.error(
                "Erreur SQLite :",
                err
            );
        } else {

            console.log(
                "✅ Base SQLite connectée"
            );

        }

    }
);


// Création des tables

db.serialize(() => {


    db.run(`

        CREATE TABLE IF NOT EXISTS voice_logs (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id TEXT,

            username TEXT,

            channel_id TEXT,

            channel_name TEXT,

            joined_at INTEGER,

            left_at INTEGER,

            duration INTEGER

        )

    `);



    db.run(`

        CREATE TABLE IF NOT EXISTS reports (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id TEXT,

            reporter_id TEXT,

            reason TEXT,

            description TEXT,

            created_at INTEGER

        )

    `);



    db.run(`

        CREATE TABLE IF NOT EXISTS trust_score (

            user_id TEXT PRIMARY KEY,

            score INTEGER DEFAULT 100

        )

    `);


});


// ======================================================
// BOT READY
// ======================================================

client.once(
    Events.ClientReady,
    async () => {


        console.log(
            `✅ Sentinel connecté : ${client.user.tag}`
        );


        client.user.setActivity(
            "la sécurité vocale",
            {
                type:
                ActivityType.Watching
            }
        );


        // Connexion automatique au vocal

        if (VOICE_CHANNEL_ID) {


            const channel =
                await client.channels.fetch(
                    VOICE_CHANNEL_ID
                );


            if (channel) {


                joinVoiceChannel({

                    channelId:
                    channel.id,

                    guildId:
                    channel.guild.id,

                    adapterCreator:
                    channel.guild.voiceAdapterCreator,

                    selfDeaf:
                    false

                });


                console.log(
                    "🎤 Vocal permanent activé"
                );


            }

        }


    }
);


// ======================================================
// CONNEXION DISCORD
// ======================================================

client.login(TOKEN);




// ======================================================
// SYSTEME DE SURVEILLANCE VOCALE
// ======================================================

client.on(
    Events.VoiceStateUpdate,
    async (oldState, newState) => {


        const member =
            newState.member || oldState.member;


        if (!member || member.user.bot)
            return;



        const userId =
            member.id;



        const username =
            member.user.username;



        const now =
            Date.now();



        // ==========================================
        // UTILISATEUR REJOINT UN VOCAL
        // ==========================================

        if (
            !oldState.channelId &&
            newState.channelId
        ) {


            client.voiceSessions.set(
                userId,
                {

                    channelId:
                    newState.channelId,

                    channelName:
                    newState.channel.name,

                    joinedAt:
                    now

                }
            );


            console.log(
                `🟢 ${username} rejoint ${newState.channel.name}`
            );


            return;


        }



        // ==========================================
        // UTILISATEUR QUITTE UN VOCAL
        // ==========================================

        if (
            oldState.channelId &&
            !newState.channelId
        ) {


            const session =
                client.voiceSessions.get(userId);



            if (session) {


                const duration =
                    now - session.joinedAt;



                db.run(

                    `

                    INSERT INTO voice_logs

                    (
                        user_id,
                        username,
                        channel_id,
                        channel_name,
                        joined_at,
                        left_at,
                        duration
                    )

                    VALUES (?, ?, ?, ?, ?, ?, ?)

                    `,

                    [

                        userId,

                        username,

                        session.channelId,

                        session.channelName,

                        session.joinedAt,

                        now,

                        duration

                    ]

                );



                console.log(

                    `🔴 ${username} quitte ${session.channelName} (${Math.floor(duration / 60000)} min)`

                );



                client.voiceSessions.delete(
                    userId
                );


            }


            return;


        }



        // ==========================================
        // CHANGEMENT DE SALON VOCAL
        // ==========================================

        if (

            oldState.channelId &&

            newState.channelId &&

            oldState.channelId !== newState.channelId

        ) {



            const session =
                client.voiceSessions.get(userId);



            if (session) {


                const duration =
                    now - session.joinedAt;



                db.run(

                    `

                    INSERT INTO voice_logs

                    (
                        user_id,
                        username,
                        channel_id,
                        channel_name,
                        joined_at,
                        left_at,
                        duration
                    )

                    VALUES (?, ?, ?, ?, ?, ?, ?)

                    `,

                    [

                        userId,

                        username,

                        session.channelId,

                        session.channelName,

                        session.joinedAt,

                        now,

                        duration

                    ]

                );


            }



            client.voiceSessions.set(

                userId,

                {

                    channelId:
                    newState.channelId,


                    channelName:
                    newState.channel.name,


                    joinedAt:
                    now

                }

            );



            console.log(

                `🔄 ${username} change vers ${newState.channel.name}`

            );


        }



    }

);




// ======================================================
// SYSTEME DE DETECTION COMPORTEMENTS SUSPECTS
// ======================================================


// Historique des mouvements vocaux
client.voiceActivity = new Map();


// Arrivées récentes dans les vocaux
client.recentJoins = [];



// ======================================================
// ENVOI D'ALERTE STAFF
// ======================================================

async function sendStaffAlert(message) {


    if (!STAFF_CHANNEL_ID)
        return;


    try {


        const channel =
            await client.channels.fetch(
                STAFF_CHANNEL_ID
            );


        if (!channel)
            return;



        channel.send({

            content:
            `🚨 **Alerte Sentinel-01**\n${message}`

        });



    } catch(err) {


        console.error(
            "Erreur alerte staff :",
            err
        );


    }


}




// ======================================================
// ANALYSE DES EVENEMENTS VOCAUX
// ======================================================

client.on(
    Events.VoiceStateUpdate,
    async (oldState, newState) => {


        const member =
            newState.member || oldState.member;


        if (!member || member.user.bot)
            return;



        const userId =
            member.id;



        const username =
            member.user.username;



        const now =
            Date.now();



        // ==========================================
        // DETECTION CHANGEMENTS RAPIDES
        // ==========================================

        if (
            oldState.channelId &&
            newState.channelId &&
            oldState.channelId !== newState.channelId
        ) {



            if (!client.voiceActivity.has(userId)) {


                client.voiceActivity.set(
                    userId,
                    []
                );


            }



            const actions =
                client.voiceActivity.get(userId);



            actions.push(now);



            // Garde seulement les 2 dernières minutes

            const filtered =
                actions.filter(
                    time =>
                    now - time < 120000
                );



            client.voiceActivity.set(
                userId,
                filtered
            );



            if (filtered.length >= 8) {


                await sendStaffAlert(

                    `👤 **${username}** a changé de salon vocal ${filtered.length} fois en moins de 2 minutes.`

                );


                // On vide pour éviter le spam

                client.voiceActivity.set(
                    userId,
                    []
                );


            }


        }




        // ==========================================
        // DETECTION REJOINT/QUITTE EN BOUCLE
        // ==========================================


        if (
            !oldState.channelId &&
            newState.channelId
        ) {


            if (!client.voiceActivity.has(userId)) {


                client.voiceActivity.set(
                    userId,
                    []
                );


            }



            const actions =
                client.voiceActivity.get(userId);



            actions.push(now);



            const filtered =
                actions.filter(

                    time =>
                    now - time < 120000

                );



            client.voiceActivity.set(
                userId,
                filtered
            );



            if (filtered.length >= 15) {


                await sendStaffAlert(

                    `⚠️ **${username}** a rejoint des salons vocaux ${filtered.length} fois en moins de 2 minutes.`

                );



                client.voiceActivity.set(
                    userId,
                    []
                );


            }


        }




        // ==========================================
        // ARRIVEES MULTIPLES SIMULTANEES
        // ==========================================


        if (
            !oldState.channelId &&
            newState.channelId
        ) {



            client.recentJoins.push({

                user:
                username,

                id:
                userId,

                channel:
                newState.channelId,

                time:
                now

            });



            client.recentJoins =
                client.recentJoins.filter(

                    join =>
                    now - join.time < 10000

                );



            if (
                client.recentJoins.length >= 5
            ) {



                const users =
                    client.recentJoins
                    .map(
                        x => x.user
                    )
                    .join(", ");



                await sendStaffAlert(

                    `👥 Plusieurs comptes ont rejoint un vocal en même temps :\n${users}`

                );



                client.recentJoins = [];


            }


        }



    }

);




// ======================================================
// SYSTEME DE REPORT INTELLIGENT
// ======================================================


// Gestion des commandes slash

client.on(
    Events.InteractionCreate,
    async interaction => {


        if (!interaction.isChatInputCommand())
            return;



        // ==================================================
        // COMMANDE /REPORT
        // ==================================================

        if (
            interaction.commandName === "report"
        ) {


            const user =
                interaction.options.getUser(
                    "utilisateur"
                );


            const reason =
                interaction.options.getString(
                    "motif"
                );


            const description =
                interaction.options.getString(
                    "description"
                );



            if (!user) {


                return interaction.reply({

                    content:
                    "❌ Utilisateur manquant.",

                    ephemeral:
                    true

                });


            }




            const reportedMember =
                await interaction.guild.members.fetch(
                    user.id
                );



            // ======================================
            // INFOS AUTOMATIQUES
            // ======================================


            const date =
                new Date()
                .toLocaleString(
                    "fr-FR"
                );



            let voiceInfo =
                "🔇 Aucun vocal actuellement";



            let duration =
                "N/A";



            const session =
                client.voiceSessions.get(
                    user.id
                );



            if (session) {


                const time =
                    Date.now()
                    -
                    session.joinedAt;



                duration =
                    `${Math.floor(time / 60000)} minutes`;



                voiceInfo =

                `🎤 ${session.channelName}`;


            }




            // ======================================
            // PERSONNES PRESENTES
            // ======================================


            let usersInVoice =
                "Aucune";



            if (
                reportedMember.voice.channel
            ) {


                usersInVoice =

                reportedMember.voice.channel.members

                .filter(
                    m => !m.user.bot
                )

                .map(
                    m => m.user.username
                )

                .join(", ");


            }




            // ======================================
            // SAUVEGARDE DATABASE
            // ======================================


            db.run(

                `

                INSERT INTO reports

                (

                    user_id,

                    reporter_id,

                    reason,

                    description,

                    created_at

                )

                VALUES (?, ?, ?, ?, ?)

                `,


                [

                    user.id,

                    interaction.user.id,

                    reason,

                    description,

                    Date.now()

                ]

            );






            // ======================================
            // MESSAGE STAFF
            // ======================================


            const reportMessage = `

🚨 **Nouveau report Sentinel**

👤 Utilisateur :
${user.tag}

🆔 ID :
${user.id}

📌 Pseudo actuel :
${reportedMember.displayName}

📅 Heure :
${date}

📋 Motif :
${reason}

📝 Description :
${description}

${voiceInfo}

⏱️ Temps vocal :
${duration}

👥 Présents dans le salon :
${usersInVoice}

👮 Report par :
${interaction.user.tag}

`;




            if (STAFF_CHANNEL_ID) {


                const staff =
                    await client.channels.fetch(
                        STAFF_CHANNEL_ID
                    );


                if (staff) {


                    staff.send({
                        content:
                        reportMessage
                    });


                }


            }




            await interaction.reply({

                content:
                "✅ Report envoyé au staff.",

                ephemeral:
                true

            });



        }



    }

);




// ======================================================
// COMMANDES STAFF : STATUS / STATISTIQUES
// ======================================================


// Formatage de l'uptime

function formatUptime(ms) {


    const secondes =
        Math.floor(ms / 1000);



    const jours =
        Math.floor(secondes / 86400);



    const heures =
        Math.floor(
            (secondes % 86400) / 3600
        );



    const minutes =
        Math.floor(
            (secondes % 3600) / 60
        );



    const secs =
        secondes % 60;



    return `${jours}j ${heures}h ${minutes}m ${secs}s`;

}



// ======================================================
// INTERACTIONS STAFF
// ======================================================

client.on(
    Events.InteractionCreate,
    async interaction => {


        if (!interaction.isChatInputCommand())
            return;



        // ==================================================
        // /STATUS
        // ==================================================

        if (
            interaction.commandName === "status"
        ) {



            let reportCount = 0;



            db.get(

                `SELECT COUNT(*) AS total FROM reports`,

                [],

                async (err,row)=>{


                    if (!err && row) {

                        reportCount =
                        row.total;

                    }



                    const connection =
                        getVoiceConnection(
                            interaction.guild.id
                        );



                    const vocalStatus =
                    connection

                    ?
                    "🟢 Connecté"

                    :
                    "🔴 Déconnecté";




                    const message = `

🛡️ **Sentinel-01 Status**

🤖 Bot :
✅ En ligne

🎤 Vocal permanent :
${vocalStatus}

⏱️ Uptime :
${formatUptime(
    Date.now() - client.readyTimestamp
)}

📋 Reports enregistrés :
${reportCount}

👥 Membres surveillés :
${client.voiceSessions.size}

🚨 Surveillance :
Active

`;



                    await interaction.reply({

                        content:
                        message,

                        ephemeral:
                        true

                    });



                }

            );



        }




        // ==================================================
        // /USERINFO
        // ==================================================

        if (
            interaction.commandName === "userinfo"
        ) {



            const user =
                interaction.options.getUser(
                    "utilisateur"
                );



            if (!user) {


                return interaction.reply({

                    content:
                    "❌ Utilisateur absent.",

                    ephemeral:
                    true

                });


            }



            let totalTime = 0;



            db.all(

                `

                SELECT duration

                FROM voice_logs

                WHERE user_id = ?

                `,

                [

                    user.id

                ],

                async(err, rows)=>{


                    if (!err && rows) {


                        rows.forEach(

                            row => {

                                totalTime +=
                                row.duration || 0;

                            }

                        );


                    }




                    db.get(

                        `

                        SELECT COUNT(*) AS total

                        FROM reports

                        WHERE user_id = ?

                        `,

                        [

                            user.id

                        ],

                        async(err, report)=>{


                            const minutes =
                            Math.floor(
                                totalTime / 60000
                            );



                            const member =
                            await interaction.guild.members.fetch(
                                user.id
                            )
                            .catch(()=>null);



                            const score =
                            await getTrustScore(
                                user.id
                            );



                            await interaction.reply({

                                content:`


📊 **Informations Sentinel**

👤 Utilisateur :
${user.tag}

🆔 ID :
${user.id}

📌 Pseudo actuel :
${member?.displayName || "Inconnu"}

🎤 Temps vocal total :
${minutes} minutes

📋 Reports :
${report?.total || 0}

🧠 Score confiance :
${score}/100


`,

                                ephemeral:true

                            });


                        }

                    );


                }

            );


        }



    }

);




// ======================================================
// SYSTEME DE SCORE DE CONFIANCE AUTOMATIQUE
// ======================================================


// Modifier le score d'un utilisateur

function updateTrustScore(userId, amount) {


    return new Promise((resolve)=>{


        db.get(

            `

            SELECT score

            FROM trust_score

            WHERE user_id = ?

            `,

            [

                userId

            ],


            (err,row)=>{


                let current = 100;



                if(row) {

                    current =
                    row.score;

                }



                let newScore =
                current + amount;



                // Limites du score

                if(newScore > 100)
                    newScore = 100;


                if(newScore < 0)
                    newScore = 0;




                db.run(

                    `

                    INSERT INTO trust_score

                    (

                        user_id,

                        score

                    )

                    VALUES (?, ?)

                    ON CONFLICT(user_id)

                    DO UPDATE SET score = ?

                    `,

                    [

                        userId,

                        newScore,

                        newScore

                    ],


                    ()=>{


                        resolve(
                            newScore
                        );


                    }

                );


            }


        );


    });


}




// ======================================================
// MALUS AUTOMATIQUE
// ======================================================


// Quand un comportement suspect est détecté

async function applySuspicionPenalty(
    userId,
    reason
) {


    const score =
    await updateTrustScore(
        userId,
        -10
    );



    console.log(

        `⚠️ Score confiance ${userId} : ${score}/100 (${reason})`

    );


    return score;

}




// ======================================================
// BONUS AUTOMATIQUE
// ======================================================


// Utilisateur actif normalement

async function applyPositiveActivity(
    userId
) {


    const score =
    await updateTrustScore(
        userId,
        1
    );



    return score;

}




// ======================================================
// LIAISON AVEC LES ALERTES VOCALES
// ======================================================


client.on(
    Events.VoiceStateUpdate,
    async(oldState,newState)=>{


        const member =
        newState.member || oldState.member;



        if(!member || member.user.bot)
            return;



        const userId =
        member.id;



        // Changement excessif de salon

        if(

            oldState.channelId &&

            newState.channelId &&

            oldState.channelId !== newState.channelId

        ){


            const activity =
            client.voiceActivity.get(
                userId
            );



            if(
                activity &&
                activity.length >= 8
            ){


                await applySuspicionPenalty(

                    userId,

                    "Spam vocal"

                );


            }


        }



        // Entrée normale

        if(
            !oldState.channelId &&
            newState.channelId
        ){


            await applyPositiveActivity(
                userId
            );


        }



    }

);




// ======================================================
// COMMANDE /TRUST
// ======================================================

client.on(
    Events.InteractionCreate,
    async interaction=>{


        if(!interaction.isChatInputCommand())
            return;



        if(
            interaction.commandName !== "trust"
        )
            return;



        const user =
        interaction.options.getUser(
            "utilisateur"
        );



        const score =
        await getTrustScore(
            user.id
        );



        await interaction.reply({

            content:

`🧠 **Score Sentinel**

👤 ${user.tag}

Score :
${score}/100

`,

            ephemeral:true

        });


    }

);




// ======================================================
// STATISTIQUES VOCALES
// ======================================================


// Récupérer le temps vocal d'un utilisateur
// sur une période donnée

function getVoiceTime(
    userId,
    since
) {


    return new Promise((resolve)=>{


        db.get(

            `

            SELECT SUM(duration) AS total

            FROM voice_logs

            WHERE user_id = ?

            AND joined_at >= ?

            `,


            [

                userId,

                since

            ],


            (err,row)=>{


                if(err || !row) {

                    resolve(0);

                    return;

                }



                resolve(
                    row.total || 0
                );


            }

        );


    });


}




// Convertir millisecondes en texte

function formatDuration(ms) {


    if(!ms)
        return "0 minute";



    const minutes =
    Math.floor(
        ms / 60000
    );



    const hours =
    Math.floor(
        minutes / 60
    );



    const remaining =
    minutes % 60;



    if(hours > 0) {

        return `${hours}h ${remaining}min`;

    }


    return `${remaining}min`;

}




// ======================================================
// CLASSEMENT VOCAL
// ======================================================

async function getVoiceRanking(){


    return new Promise((resolve)=>{


        db.all(

            `

            SELECT

            username,

            SUM(duration) AS total


            FROM voice_logs


            GROUP BY user_id


            ORDER BY total DESC


            LIMIT 10


            `,


            [],


            (err,rows)=>{


                resolve(
                    rows || []
                );


            }

        );


    });


}





// ======================================================
// COMMANDE /STATS
// ======================================================


client.on(
    Events.InteractionCreate,
    async interaction=>{


        if(!interaction.isChatInputCommand())
            return;



        if(
            interaction.commandName !== "stats"
        )
            return;




        const user =
        interaction.options.getUser(
            "utilisateur"
        );



        if(!user){


            return interaction.reply({

                content:
                "❌ Utilisateur manquant.",

                ephemeral:true

            });


        }




        const today =
        new Date();



        today.setHours(
            0,
            0,
            0,
            0
        );



        const week =
        Date.now()
        -
        (
            7 *
            24 *
            60 *
            60 *
            1000
        );



        const todayTime =
        await getVoiceTime(

            user.id,

            today.getTime()

        );



        const weekTime =
        await getVoiceTime(

            user.id,

            week

        );



        const totalTime =
        await getVoiceTime(

            user.id,

            0

        );



        const score =
        await getTrustScore(
            user.id
        );



        await interaction.reply({

            content:

`

📊 **Statistiques Sentinel**

👤 Utilisateur :
${user.tag}

🎤 Vocal aujourd'hui :
${formatDuration(todayTime)}

📅 Vocal cette semaine :
${formatDuration(weekTime)}

⏱️ Vocal total :
${formatDuration(totalTime)}

🧠 Score confiance :
${score}/100

`

        });



    }

);




// ======================================================
// COMMANDE /TOPVOCAL
// ======================================================


client.on(
    Events.InteractionCreate,
    async interaction=>{


        if(!interaction.isChatInputCommand())
            return;



        if(
            interaction.commandName !== "topvocal"
        )
            return;




        const ranking =
        await getVoiceRanking();



        let text =
        "🏆 **Classement vocal Sentinel**\n\n";



        ranking.forEach(

            (member,index)=>{


                text +=

`${index + 1}. ${member.username} — ${formatDuration(member.total)}

`;

            }

        );



        await interaction.reply({

            content:
            text

        });



    }

);




// ======================================================
// VOCAL PERMANENT : SYSTEME DE RECONNEXION
// ======================================================


let voiceReconnectTimer = null;



// ======================================================
// CONNEXION AU VOCAL
// ======================================================

async function connectPermanentVoice() {


    if(!VOICE_CHANNEL_ID)
        return;



    try {


        const channel =
        await client.channels.fetch(
            VOICE_CHANNEL_ID
        );



        if(!channel)
            return;



        const connection =
        getVoiceConnection(
            channel.guild.id
        );



        // Déjà connecté

        if(connection)
            return;




        joinVoiceChannel({

            channelId:
            channel.id,


            guildId:
            channel.guild.id,


            adapterCreator:
            channel.guild.voiceAdapterCreator,


            selfDeaf:false,


            selfMute:false

        });



        console.log(
            "🎤 Connexion vocal Sentinel active"
        );



    }
    catch(error){


        console.error(

            "Erreur connexion vocal :",

            error

        );


    }


}





// ======================================================
// SURVEILLANCE DE CONNEXION
// ======================================================

function startVoiceWatcher(){



    if(voiceReconnectTimer)
        clearInterval(
            voiceReconnectTimer
        );



    voiceReconnectTimer =
    setInterval(
        async()=>{


            if(!client.guilds.cache.size)
                return;



            const guild =
            client.guilds.cache.first();



            const connection =
            getVoiceConnection(
                guild.id
            );



            if(!connection){


                console.log(
                    "⚠️ Vocal perdu, reconnexion..."
                );


                await connectPermanentVoice();


            }



        },

        30000

    );


}




// ======================================================
// DEMARRAGE SUR READY
// ======================================================


client.once(
    Events.ClientReady,
    async()=>{


        await connectPermanentVoice();


        startVoiceWatcher();



    }

);





// ======================================================
// GESTION DES ERREURS VOCALES
// ======================================================


process.on(
    "uncaughtException",
    error=>{


        console.error(
            "Erreur globale :",
            error
        );


    }

);



process.on(
    "unhandledRejection",
    error=>{


        console.error(
            "Promesse refusée :",
            error
        );


    }

);





// ======================================================
// ARRET PROPRE DU BOT
// ======================================================


async function shutdown(){


    console.log(
        "🛑 Arrêt Sentinel..."
    );



    if(voiceReconnectTimer){

        clearInterval(
            voiceReconnectTimer
        );

    }



    db.close(
        ()=>{
            console.log(
                "💾 Base SQLite fermée"
            );
        }
    );



    client.destroy();


    process.exit(0);


}




process.on(
    "SIGINT",
    shutdown
);



process.on(
    "SIGTERM",
    shutdown
);




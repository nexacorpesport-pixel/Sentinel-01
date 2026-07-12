const {
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

require("dotenv").config();


// ======================================================
// COMMANDES SENTINEL v2
// ======================================================


const commands = [


    // ==========================================
    // /REPORT
    // ==========================================

    new SlashCommandBuilder()

    .setName("report")

    .setDescription(
        "Signaler un problème à Sentinel"
    )

    .addUserOption(option =>

        option
        .setName("utilisateur")
        .setDescription(
            "Utilisateur concerné"
        )
        .setRequired(true)

    )

    .addStringOption(option =>

        option
        .setName("motif")
        .setDescription(
            "Motif du report"
        )
        .setRequired(true)

    )

    .addStringOption(option =>

        option
        .setName("description")
        .setDescription(
            "Description détaillée"
        )
        .setRequired(true)

    ),



    // ==========================================
    // /STATUS
    // ==========================================

    new SlashCommandBuilder()

    .setName("status")

    .setDescription(
        "Afficher l'état de Sentinel"
    ),




    // ==========================================
    // /USERINFO
    // ==========================================

    new SlashCommandBuilder()

    .setName("userinfo")

    .setDescription(
        "Afficher les informations Sentinel d'un membre"
    )

    .addUserOption(option =>

        option
        .setName("utilisateur")
        .setDescription(
            "Utilisateur à consulter"
        )
        .setRequired(true)

    ),




    // ==========================================
    // /TRUST
    // ==========================================

    new SlashCommandBuilder()

    .setName("trust")

    .setDescription(
        "Afficher le score de confiance Sentinel"
    )

    .addUserOption(option =>

        option
        .setName("utilisateur")
        .setDescription(
            "Utilisateur à analyser"
        )
        .setRequired(true)

    ),




    // ==========================================
    // /STATS
    // ==========================================

    new SlashCommandBuilder()

    .setName("stats")

    .setDescription(
        "Afficher les statistiques vocales"
    )

    .addUserOption(option =>

        option
        .setName("utilisateur")
        .setDescription(
            "Utilisateur à analyser"
        )
        .setRequired(true)

    ),




    // ==========================================
    // /TOPVOCAL
    // ==========================================

    new SlashCommandBuilder()

    .setName("topvocal")

    .setDescription(
        "Afficher le classement vocal"
    )


];



// Conversion JSON

const commandData =
commands.map(
    command => command.toJSON()
);




// ======================================================
// DEPLOIEMENT DISCORD
// ======================================================


const rest = new REST({

    version:"10"

})

.setToken(
    process.env.DISCORD_TOKEN
);



rest.put(

    Routes.applicationGuildCommands(

        process.env.CLIENT_ID,

        process.env.GUILD_ID

    ),

    {

        body: commandData

    }

)

.then(()=>{


    console.log(
        "✅ Commandes Sentinel v2 installées"
    );


})

.catch(console.error);
require("dotenv").config();

const express = require("express");

const {
    Client,
    GatewayIntentBits,
    ActivityType
} = require("discord.js");

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus
} = require("@discordjs/voice");

const { spawn } = require("child_process");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");

const config = require("./config.json");


// =======================
// SERVEUR HTTP RENDER
// =======================

const app = express();

const PORT = process.env.PORT || 3000;


app.get("/", (req, res) => {

    res.status(200).send(
        "🛡️ Sentinel-01 opérationnel"
    );

});


app.get("/health", (req, res) => {

    res.status(200).json({
        status: "online",
        bot: client.user ? client.user.tag : "starting"
    });

});


app.listen(PORT, () => {

    console.log(
        `Serveur HTTP actif sur le port ${PORT}`
    );

});


// =======================
// BOT DISCORD
// =======================


const client = new Client({

    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]

});


let alreadyPlayed = false;



client.once("ready", () => {

    console.log(`${client.user.tag} connecté`);

    client.user.setActivity(
        "/report | Signaler un problème",
        {
            type: ActivityType.Listening
        }
    );


    console.log(
        "Surveillance du vocal activée"
    );

});





client.on(
"voiceStateUpdate",
async (oldState, newState) => {


    const channel = newState.channel;


    if (!channel) return;


    if (channel.id !== config.voiceChannelId) {
        return;
    }



    const members = channel.members.filter(
        member => !member.user.bot
    );



    console.log(
        `${channel.name} : ${members.size} membre(s)`
    );



    if (
        members.size === 1 &&
        !alreadyPlayed
    ) {


        alreadyPlayed = true;

        await playReminder(channel);

    }



    if (members.size === 0) {

        alreadyPlayed = false;

    }


});







async function playReminder(channel) {


    console.log(
        "Connexion au vocal..."
    );



    const connection = joinVoiceChannel({

        channelId: channel.id,

        guildId: channel.guild.id,

        adapterCreator:
        channel.guild.voiceAdapterCreator,

        selfDeaf:false,
        selfMute:false

    });




    connection.on(
        VoiceConnectionStatus.Ready,
        () => {

            console.log(
                "Bot connecté au vocal"
            );

        }
    );





    const player = createAudioPlayer();


    connection.subscribe(player);





    if (!fs.existsSync("./rappel.mp3")) {

        console.log(
            "rappel.mp3 introuvable"
        );

        return;

    }





    const ffmpegProcess = spawn(
        ffmpeg,
        [
            "-i",
            "./rappel.mp3",

            "-f",
            "s16le",

            "-ar",
            "48000",

            "-ac",
            "2",

            "pipe:1"
        ]
    );





    const resource =
    createAudioResource(
        ffmpegProcess.stdout
    );




    player.play(resource);




    player.on(
        AudioPlayerStatus.Playing,
        () => {

            console.log(
                "Rappel en lecture"
            );

        }
    );




    player.on(
        AudioPlayerStatus.Idle,
        () => {

            console.log(
                "Rappel terminé"
            );

        }
    );




    player.on(
        "error",
        error => {

            console.log(
                "Erreur audio :",
                error
            );

        }
    );


}






client.login(
    process.env.DISCORD_TOKEN
);

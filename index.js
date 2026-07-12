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
    VoiceConnectionStatus,
    StreamType
} = require("@discordjs/voice");


const { spawn } = require("child_process");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");


const config = require("./config.json");


// =====================
// RENDER WEB SERVER
// =====================

const app = express();

const PORT = process.env.PORT || 3000;


app.get("/", (req,res)=>{
    res.send("🛡️ Sentinel-01 Online");
});


app.get("/health",(req,res)=>{
    res.json({
        status:"online"
    });
});


app.listen(PORT,()=>{
    console.log(`HTTP actif sur ${PORT}`);
});




// =====================
// DISCORD CLIENT
// =====================

const client = new Client({

    intents:[
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]

});



let voiceConnection = null;
let alreadyPlayed = false;



// =====================
// READY
// =====================


client.once("ready", async()=>{


    console.log(
        `${client.user.tag} connecté`
    );


    client.user.setActivity(
        "/report | Signaler",
        {
            type: ActivityType.Listening
        }
    );


    await connectVoice();


});




// =====================
// JOIN VOCAL PERMANENT
// =====================


async function connectVoice(){


    const guild =
    client.guilds.cache.first();


    if(!guild){
        console.log("Serveur introuvable");
        return;
    }



    const channel =
    guild.channels.cache.get(
        config.voiceChannelId
    );


    if(!channel){

        console.log(
            "Vocal introuvable"
        );

        return;
    }



    voiceConnection =
    joinVoiceChannel({

        channelId:channel.id,

        guildId:guild.id,

        adapterCreator:
        guild.voiceAdapterCreator,

        selfMute:false,

        selfDeaf:false

    });



    voiceConnection.on(
        VoiceConnectionStatus.Ready,
        ()=>{
            console.log(
                "🛡️ Sentinel dans le vocal"
            );
        }
    );



    voiceConnection.on(
        VoiceConnectionStatus.Disconnected,
        ()=>{

            console.log(
                "Vocal déconnecté, reconnexion..."
            );

            setTimeout(connectVoice,5000);

        }
    );


}




// =====================
// SURVEILLANCE VOCAL
// =====================


client.on(
"voiceStateUpdate",
async(oldState,newState)=>{


    const channel =
    newState.channel;


    if(!channel)
        return;



    if(
        channel.id !== config.voiceChannelId
    )
        return;




    const members =
    channel.members.filter(
        m=>!m.user.bot
    );



    console.log(
        `Membres vocal : ${members.size}`
    );




    if(
        members.size === 1 &&
        !alreadyPlayed
    ){

        alreadyPlayed=true;

        playReminder();

    }



    if(members.size===0){

        alreadyPlayed=false;

    }


});




// =====================
// AUDIO
// =====================


function playReminder(){


    if(!voiceConnection){

        console.log(
            "Pas connecté"
        );

        return;

    }



    if(
        !fs.existsSync("./rappel.mp3")
    ){

        console.log(
            "rappel.mp3 absent"
        );

        return;

    }



    const player =
    createAudioPlayer();



    voiceConnection.subscribe(
        player
    );



    const ffmpegProcess =
    spawn(ffmpeg,[

        "-i",
        "./rappel.mp3",

        "-f",
        "s16le",

        "-ar",
        "48000",

        "-ac",
        "2",

        "pipe:1"

    ]);



    const resource =
    createAudioResource(
        ffmpegProcess.stdout,
        {
            inputType:StreamType.Raw
        }
    );



    player.play(resource);



    player.on(
        AudioPlayerStatus.Playing,
        ()=>{
            console.log(
                "🔊 Rappel lancé"
            );
        }
    );


    player.on(
        AudioPlayerStatus.Idle,
        ()=>{
            console.log(
                "✅ Rappel terminé"
            );
        }
    );


    player.on(
        "error",
        e=>{
            console.log(
                "Erreur audio",
                e
            );
        }
    );

}




client.login(
    process.env.DISCORD_TOKEN
);

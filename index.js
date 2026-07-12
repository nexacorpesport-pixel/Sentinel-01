require("dotenv").config();

const express = require("express");

const {
    Client,
    GatewayIntentBits,
    ActivityType,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
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
// WEB SERVER
// =====================

const app = express();

const PORT = process.env.PORT || 3000;


app.get("/",(req,res)=>{
    res.send("🛡️ Sentinel-01 Online");
});


app.get("/health",(req,res)=>{
    res.json({
        status:"online"
    });
});


app.listen(PORT,()=>{
    console.log(
        `HTTP actif sur ${PORT}`
    );
});



// =====================
// DISCORD
// =====================

const client = new Client({

    intents:[

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildVoiceStates,

        GatewayIntentBits.GuildMembers

    ]

});



// =====================
// VARIABLES
// =====================

let voiceConnection = null;

let audioPlayer = null;

let alreadyPlayed = false;

let lastVoiceUsers = [];

let reconnecting = false;



// =====================
// READY
// =====================

client.once(
"ready",
async()=>{


    console.log(
        `${client.user.tag} connecté`
    );


    client.user.setActivity(
        "/report | Signaler",
        {
            type:ActivityType.Listening
        }
    );


    connectVoice();


});




// =====================
// VOCAL CONNECT
// =====================

async function connectVoice(){


    if(reconnecting)
        return;


    reconnecting=true;


    try{


        const guild =
        client.guilds.cache.first();



        if(!guild){

            reconnecting=false;
            return;

        }



        const channel =
        guild.channels.cache.get(
            config.voiceChannelId
        );



        if(!channel){

            console.log(
                "Salon vocal introuvable"
            );

            reconnecting=false;
            return;

        }



        voiceConnection =
        joinVoiceChannel({

            channelId:channel.id,

            guildId:guild.id,

            adapterCreator:
            guild.voiceAdapterCreator,

            selfMute:false,

            selfDeaf:true,

            debug:true

        });



        voiceConnection.on(
        "error",
        error=>{

            console.log(
                "Erreur vocal:",
                error.message
            );

        });



        voiceConnection.on(
        VoiceConnectionStatus.Ready,
        ()=>{

            console.log(
                "🛡️ Sentinel connecté au vocal"
            );

            reconnecting=false;

        });



        voiceConnection.on(
        VoiceConnectionStatus.Disconnected,
        ()=>{

            console.log(
                "⚠️ Vocal déconnecté"
            );


            voiceConnection=null;


            setTimeout(
                connectVoice,
                5000
            );

        });



    }catch(error){


        console.log(
            "Erreur connexion vocal:",
            error.message
        );


        reconnecting=false;


        setTimeout(
            connectVoice,
            10000
        );

    }


}



// =====================
// SURVEILLANCE VOCAL
// =====================

client.on(
"voiceStateUpdate",
async(oldState,newState)=>{


    const member = newState.member;



    if(
        member &&
        !member.user.bot &&
        newState.channel
    ){

        lastVoiceUsers.unshift({

            id:member.id,

            name:member.user.tag,

            time:Date.now()

        });


        lastVoiceUsers =
        lastVoiceUsers.slice(0,20);

    }



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
        `👥 Vocal : ${members.size} membre(s)`
    );



    if(
        members.size === 1 &&
        !alreadyPlayed
    ){

        alreadyPlayed=true;

        playReminder();

    }



    if(
        members.size === 0
    ){

        alreadyPlayed=false;

    }


});




// =====================
// AUDIO RAPPEL
// =====================

function playReminder(){


    if(!voiceConnection){

        console.log(
            "Pas connecté au vocal"
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



    if(!audioPlayer){

        audioPlayer =
        createAudioPlayer();


        audioPlayer.on(
        "error",
        error=>{

            console.log(
                "Erreur audio:",
                error.message
            );

        });

    }



    voiceConnection.subscribe(
        audioPlayer
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



    ffmpegProcess.on(
    "error",
    error=>{

        console.log(
            "Erreur FFmpeg:",
            error.message
        );

    });



    const resource =
    createAudioResource(

        ffmpegProcess.stdout,

        {
            inputType:StreamType.Raw
        }

    );



    audioPlayer.play(
        resource
    );



    audioPlayer.on(
    AudioPlayerStatus.Playing,
    ()=>{

        console.log(
            "🔊 Rappel lancé"
        );

    });



    audioPlayer.on(
    AudioPlayerStatus.Idle,
    ()=>{

        console.log(
            "✅ Rappel terminé"
        );

    });


}



// =====================
// SYSTEME REPORT MODAL
// =====================

client.on(
"interactionCreate",
async interaction=>{


    // Commande /report

    if(interaction.isChatInputCommand()){


        if(
            interaction.commandName === "report"
        ){


            const modal =
            new ModalBuilder()

            .setCustomId(
                "reportModal"
            )

            .setTitle(
                "🛡️ Sentinel - Signalement"
            );



            const userInput =
            new TextInputBuilder()

            .setCustomId(
                "reportedUser"
            )

            .setLabel(
                "Utilisateur concerné"
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setRequired(true);



            const reasonInput =
            new TextInputBuilder()

            .setCustomId(
                "reportReason"
            )

            .setLabel(
                "Raison du signalement"
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setRequired(true);



            const detailsInput =
            new TextInputBuilder()

            .setCustomId(
                "reportDetails"
            )

            .setLabel(
                "Détails"
            )

            .setStyle(
                TextInputStyle.Paragraph
            )

            .setRequired(true);



            modal.addComponents(

                new ActionRowBuilder()
                .addComponents(userInput),


                new ActionRowBuilder()
                .addComponents(reasonInput),


                new ActionRowBuilder()
                .addComponents(detailsInput)

            );



            await interaction.showModal(modal);


        }

    }




    // Réception du formulaire

    if(
        interaction.isModalSubmit()
    ){


        if(
            interaction.customId !== "reportModal"
        )
            return;



        const user =
        interaction.fields.getTextInputValue(
            "reportedUser"
        );


        const reason =
        interaction.fields.getTextInputValue(
            "reportReason"
        );


        const details =
        interaction.fields.getTextInputValue(
            "reportDetails"
        );



        const channel =
        interaction.guild?.channels.cache.get(
            config.reportChannelId
        );



        if(!channel){


            return interaction.reply({

                content:
                "❌ Salon de rapport introuvable.",

                ephemeral:true

            });

        }




        const embed =
        new EmbedBuilder()

        .setTitle(
            "🚨 Nouveau signalement Sentinel"
        )

        .setColor(
            0xff0000
        )

        .addFields(

            {
                name:"👤 Utilisateur signalé",
                value:user
            },

            {
                name:"⚠️ Motif",
                value:reason
            },

            {
                name:"📝 Détails",
                value:details
            },

            {
                name:"📨 Signalé par",
                value:interaction.user.tag
            }

        )

        .setTimestamp();



        await channel.send({

            embeds:[
                embed
            ]

        });



        await interaction.reply({

            content:
            "✅ Ton signalement a été envoyé au staff.",

            ephemeral:true

        });


    }


});




// =====================
// LOGIN
// =====================

client.login(
    process.env.DISCORD_TOKEN
);
require("dotenv").config();

const { REST, Routes } = require("discord.js");


const commands = [

    {
        name: "report",
        description: "Signaler un problème aux modérateurs"
    }

];



const rest = new REST({
    version: "10"
}).setToken(
    process.env.DISCORD_TOKEN
);



async function deploy(){


    try {


        console.log(
            "Déploiement de la commande slash..."
        );


        await rest.put(

            Routes.applicationGuildCommands(

                process.env.CLIENT_ID,

                process.env.GUILD_ID

            ),

            {
                body: commands
            }

        );


        console.log(
            "Commande /report installée !"
        );


    }

    catch(error){

        console.error(error);

    }


}


deploy();

require("dotenv").config();

const {
    REST,
    Routes
} = require("discord.js");


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



async function deployCommands(){

    try {

        console.log("Déploiement des commandes slash...");


        await rest.put(

            Routes.applicationCommands(
                process.env.CLIENT_ID
            ),

            {
                body: commands
            }

        );


        console.log(
            "Commandes slash installées avec succès !"
        );


    } catch(error){

        console.error(error);

    }

}



deployCommands();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();


const commands = [

    new SlashCommandBuilder()
    .setName("report")
    .setDescription("Signaler un problème à Sentinel")

    .toJSON()

];


const rest = new REST({
    version:"10"
})
.setToken(process.env.DISCORD_TOKEN);



rest.put(
    Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
    ),
    {
        body:commands
    }

)
.then(()=>{

    console.log("Commande /report installée");

})
.catch(console.error);
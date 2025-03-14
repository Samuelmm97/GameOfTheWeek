require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 2000;

const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;
const { MongoClient } = require("mongodb");
const uri = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@game-of-the-week.xa6jr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const { Client, Intents, ApplicationCommand } = require("discord.js");

const { token } = require("./config.json");

const GUILDID = "943707317768167424";
const ADMINID = "943715237293588531";
const GOTWROLEID = "943736596379881533";
const REGISTEREDROLEID = "943957741871968316";
const STARTGOTWCOMMANDID = "943993816019513355";
const SETGOTWCOMMANDID = "943943405921251358";
const ENDGOTWCOMMANDID = "944023500253966406";
const ENDSEASONCOMMANDID = "944314111532085269";
const VOTECOMMANDID = "948656517551374467";

// Initialize Discord Bot

const bot = new Client({ intents: [Intents.FLAGS.GUILDS] });

bot.once("ready", async function (evt) {
  console.log("Ready");
  // Setting permissions for commands based on role
  const fullPermissions = [
    {
      id: SETGOTWCOMMANDID,
      permissions: [
        {
          id: ADMINID,
          type: "ROLE",
          permission: true,
        },
      ],
    },
    {
      id: STARTGOTWCOMMANDID,
      permissions: [
        {
          id: ADMINID,
          type: "ROLE",
          permission: true,
        },
        {
          id: GOTWROLEID,
          type: "ROLE",
          permission: true,
        },
      ],
    },
    {
      id: ENDGOTWCOMMANDID,
      permissions: [
        {
          id: ADMINID,
          type: "ROLE",
          permission: true,
        },
      ],
    },
    {
      id: ENDSEASONCOMMANDID,
      permissions: [
        {
          id: ADMINID,
          type: "ROLE",
          permission: true,
        },
      ],
    },
    {
      id: VOTECOMMANDID,
      permissions: [
        {
          id: REGISTEREDROLEID,
          type: "ROLE",
          permission: true,
        },
      ],
    },
  ];
  await (
    await bot.guilds.fetch(GUILDID)
  ).commands.permissions.set({ fullPermissions });
});

bot.on("interactionCreate", async (interaction) => {
  // Our bot needs to know if it will execute a command
  let userNickname = interaction.member.nickname.split(" ")[0];
  let userId = interaction.user.id;
  console.log("Command ID: " + interaction.commandId);

  if (!interaction.isCommand()) return;
  let args = interaction.options.data;

  // It will listen for messages that will start with `!`
  // Admin only commands

  const { commandName } = interaction;
  await interaction.deferReply();
  switch (commandName) {
    // !ping
    case "setgotw":
      let homeTeam = args[0].value;
      let awayTeam = args[1].value;

      console.log(homeTeam, awayTeam);
      client.connect((err) => {
        if (err) {
          console.log(err);
          return;
        }
        const currentMatchupCollection = client
          .db("gameOfTheWeek")
          .collection("currentMatchup");
        currentMatchupCollection.findOneAndUpdate(
          {},
          {
            $set: {
              homeTeamName: homeTeam,
              awayTeamName: awayTeam,
              isLive: true,
              isEnded: false,
            },
          }
        );

        const usersCollection = client.db("gameOfTheWeek").collection("users");
        usersCollection.updateMany(
          {},
          { $set: { votedHome: false, votedAway: false, currentVote: "N/A" } }
        );
        // Giving the GOTW role to the teams playing in the game of the week
        usersCollection.findOne(
          { userName: homeTeam },
          async function (err, user) {
            let gotwRole = interaction.guild.roles.cache.get(GOTWROLEID);
            const guild = await bot.guilds.fetch(GUILDID);
            const members = await guild.members.fetch(user.discordId);
            members.roles.add(gotwRole);
            usersCollection.findOne(
              { userName: awayTeam },
              async function (err, user) {
                let gotwRole = interaction.guild.roles.cache.get(GOTWROLEID);
                const guild = await bot.guilds.fetch(GUILDID);
                const members = await guild.members.fetch(user.discordId);
                members.roles.add(gotwRole);
                await interaction.editReply(
                  "Game of the week has been set, " +
                    homeTeam +
                    " vs " +
                    awayTeam
                );
              }
            );
          }
        );
      });

      break;

    case "register":
      console.log(userId, userNickname);
      client.connect((err) => {
        if (err) {
          console.log(err);
          return;
        }
        const usersCollection = client.db("gameOfTheWeek").collection("users");
        // Sets users discord id in database based on their nickname
        usersCollection.findOneAndUpdate(
          { userName: userNickname },
          { $set: { discordId: userId } },
          async function (err, data) {
            // Check if an invalid user tried to register
            if (!data.value) {
              interaction.editReply("Failed to regiser.");
              return;
            }
            let registeredRole =
              interaction.guild.roles.cache.get(REGISTEREDROLEID);
            interaction.member.roles.add(registeredRole);
            await interaction.editReply("Successfully registered!");
          }
        );
      });

      break;

    case "startgotw":
      const currentMatchupCollection = client
        .db("gameOfTheWeek")
        .collection("currentMatchup");
      client.connect(async (err) => {
        if (err) {
          console.log(err);
          return;
        }
        let matchup = await currentMatchupCollection.findOne({});
        console.log(matchup);
        if (!matchup.isLive) {
          await interaction.editReply("Error: GOTW has already been started");
          return;
        }
        currentMatchupCollection.findOneAndUpdate(
          {},
          { $set: { isLive: false } }
        );
        await interaction.editReply(
          "@everyone GOTW is now starting, voting has been disabled"
        );
      });
      const usersCollection = client.db("gameOfTheWeek").collection("users");
      client.connect((err) => {
        if (err) {
          console.log(err);
          return;
        }
        // Finds the current GOTW team names
        currentMatchupCollection.findOne({}, function (err, data) {
          let homeTeamName = data.homeTeamName;
          let awayTeamName = data.awayTeamName;
          // Updates the users vote history with their current vote once the GOTW starts
          usersCollection.updateMany(
            { currentVote: homeTeamName },
            { $push: { voteHistory: homeTeamName } }
          );
          usersCollection.updateMany(
            { currentVote: awayTeamName },
            { $push: { voteHistory: awayTeamName } }
          );
          usersCollection.updateMany(
            { currentVote: "N/A" },
            { $push: { voteHistory: "N/A" } }
          );
        });
      });

      break;

    case "endgotw":
      let winner = args[0].value;
      client.connect(async (err) => {
        if (err) {
          console.log(err);
          return;
        }
        const currentMatchupCollection = client
          .db("gameOfTheWeek")
          .collection("currentMatchup");
        let currentMatchup = await currentMatchupCollection.findOne({});
        let teamName = currentMatchup.homeTeamName;
        const usersCollection = client.db("gameOfTheWeek").collection("users");
        let user = await usersCollection.findOne({ userName: teamName });
        const guild = await bot.guilds.fetch(GUILDID);
        let member = await guild.members.fetch(user.discordId);
        let gotwRole = interaction.guild.roles.cache.get(GOTWROLEID);
        // TRYING TO FIX MULTIPLE END GOTW COMMAND CALLS
        if (currentMatchup.isEnded) {
          await interaction.editreply(
            "ERROR: Game of The Week has already been ended, winner: " + winner
          );
          return;
        }
        // Increasing number correct for all users with the winner as their current vote
        usersCollection.updateMany(
          { currentVote: winner },
          { $inc: { numberCorrect: 1 } }
        );
        await interaction.editReply("GOTW has ended, winning team: " + winner);
        // Getting users which are currently in the GOTW
        currentMatchupCollection.findOne({}, function (err, data) {
          usersCollection
            .find(
              { userName: { $in: [data.homeTeamName, data.awayTeamName] } },
              { discordId: 1 }
            )
            .toArray(async function (err, users) {
              // Removing GOTW role from users with GOTW role
              users.forEach(async (user) => {
                const members = await guild.members.fetch(user.discordId);
                members.roles.remove(gotwRole);
              });
            });
          // Making isEnded true in the database to ensure that we dont end the GOTW multiple times
          currentMatchupCollection.findOneAndUpdate(
            {},
            { $set: { isEnded: true } }
          );
        });
      });
      break;

    case "endseason":
      let confirmation = args[0].value;
      if (confirmation != "confirm") {
        await interaction.editReply('Error: must enter "confirm" as argument');
        return;
      }
      await interaction.editReply("Sucessfully ended season");

      client.connect((err) => {
        if (err) {
          console.log(err);
          return;
        }
        const currentMatchupCollection = client
          .db("gameOfTheWeek")
          .collection("currentMatchup");
        const usersCollection = client.db("gameOfTheWeek").collection("users");
        // Resetting all user data
        usersCollection.updateMany(
          {},
          {
            $set: {
              voteHistory: [],
              numberCorrect: 0,
              currentVote: "N/A",
              votedHome: false,
              votedAway: false,
            },
          }
        );
        // Resetting isEnded so we can end the next GOTW
        currentMatchupCollection.findOneAndUpdate(
          {},
          { $set: { isEnded: false } }
        );
      });
      break;

    case "vote":
      interaction.editReply("Head over to https://gridironhub.app to vote");
      break;
  }
});

app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
);

bot.login(token);

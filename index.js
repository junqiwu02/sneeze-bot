require('dotenv').config();
const { Client, Intents } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, StreamType, EndBehaviorType } = require('@discordjs/voice');
const fs = require('fs');
const prism = require('prism-media');

const speech = require('@google-cloud/speech');

const token = process.env['TOKEN'];

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_PRESENCES,
        Intents.FLAGS.GUILD_VOICE_STATES,
    ]
});

const speechClient = new speech.SpeechClient();

const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: 'en-US',
};

const request = {
    config,
    interimResults: true, //Get interim results from stream
};

// Create a recognize stream
const recognizeStream = speechClient
    .streamingRecognize(request)
    .on('error', console.error)
    .on('data', data =>
        process.stdout.write(
        data.results[0] && data.results[0].alternatives[0]
            ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
            : '\n\nReached transcription time limit, press Ctrl+C\n'
        )
);

// let stream;

const listening = {};

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	switch(interaction.commandName) {
        case 'ping': {
            await interaction.reply('Pong!');
        } break;

        case 'join': {
            const channel = interaction.member.voice.channel;
            if (!channel) {
                interaction.reply('You are not in a voice channel!');
            } else {
                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: false,
                });

                console.log(listening);

                connection.receiver.speaking.on('start', userId => {
                    if (userId in listening && listening[userId].readable) {
                        return;
                    }

                    const stream = connection.receiver.subscribe(userId, {
                        behavior: EndBehaviorType.Manual,
                    });

                    const ws = fs.createWriteStream('raw-voice-data');
                    const raw = stream.pipe(new prism.opus.Decoder({ channels: 1, rate: 16000 }));
                    listening[userId] = stream;
                    raw.pipe(recognizeStream);
                    // stream.on('data', data => {
                    //     ws.write(encoder.decode(data));
                    // });
                    // stream.on('close', () => {
                    //     ws.close();
                    // });
                });

                // // stream closes when connection is destroyed
                // stream = connection.receiver.subscribe(interaction.member.id, {
                //     behavior: EndBehaviorType.Manual,
                // });

                // stream.pipe(recognizeStream);

                await interaction.reply('Joined your voice channel!');
            }
        } break;

        case 'leave': {
            const channel = interaction.member.voice.channel;
            if (!channel) {
                interaction.reply('You are not in a voice channel!');
            } else {
                const connection = getVoiceConnection(channel.guild.id);
                if (!connection) {
                    await interaction.reply('Not currently in a voice channel!')
                } else {
                    connection.destroy();
                    await interaction.reply('Left your voice channel!');
                }
            }
        } break;
        
        default: {
            await interaction.reply('Command not implemented!');
        }
    }
});

// Login to Discord with your client's token
client.login(token);

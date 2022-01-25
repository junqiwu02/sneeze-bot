require('dotenv').config();
const { Client, Intents } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, StreamType, EndBehaviorType } = require('@discordjs/voice');
const { OpusEncoder } = require('@discordjs/opus');

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

const encoder = new OpusEncoder(48000, 2);

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

let stream;

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
                const connection = await joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: false,
                });

                // stream closes when connection is destroyed
                stream = connection.receiver.subscribe(interaction.member.id, {
                    behavior: EndBehaviorType.Manual,
                });

                stream.pipe(recognizeStream);

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

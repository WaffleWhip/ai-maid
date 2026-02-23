import {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    Interaction,
    EmbedBuilder,
    TextChannel,
    Message,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    Partials
} from 'discord.js';
import { authCommand, modelCommand, agentCommand, clearCommand } from './commands';
import { getAllProviders } from '../provider';
import { chat } from '../chat';
import { THEME } from './constants';
import { handleModelMenuUpdate, handleModelSelection, handleProviderSelection, handleAgentSelection, handleClearSession } from './handlers';
import { logger } from '../log';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Message processing queue per session
const processingQueue = new Map<string, Promise<void>>();

client.once(Events.ClientReady, (c) => {
    console.log(`ai-maid online: ${c.user.tag}`);
    registerCommands();
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (commandName === authCommand.data.name) await authCommand.execute(interaction);
        else if (commandName === modelCommand.data.name) await modelCommand.execute(interaction);
        else if (commandName === clearCommand.data.name) await handleClearSession(interaction);
        else if (commandName === agentCommand.data.name) {
            const agentName = interaction.options.getString('name' as any);
            if (agentName) {
                await handleAgentSelection(interaction);
            } else {
                await agentCommand.execute(interaction);
            }
        }
    } else if (interaction.isStringSelectMenu()) {
        const { customId } = interaction;
        if (customId === 'select_provider') await handleProviderSelection(interaction);
        else if (customId === 'select_provider_model') await handleModelMenuUpdate(interaction);
        else if (customId === 'select_model') await handleModelSelection(interaction);
        else if (customId === 'select_agent') await handleAgentSelection(interaction);
    } else if (interaction.isButton()) {
        if (interaction.customId === 'reset_model_flow') {
            const allProviders = getAllProviders();
            const embed = new EmbedBuilder()
                .setTitle('ai-maid model selection')
                .setDescription('select a provider to change its model.')
                .setColor(THEME.ORANGE)
                .setFooter({ text: 'ai-maid orchestration' });
            const providerSelect = new StringSelectMenuBuilder()
                .setCustomId('select_provider_model')
                .setPlaceholder('choose provider...')
                .addOptions(allProviders.map(p => new StringSelectMenuOptionBuilder().setLabel(p.name).setValue(p.id)));
            await interaction.update({ 
                embeds: [embed], 
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(providerSelect)] 
            });
        }
    }
});

client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    const isDM = !message.guild;
    const isMentioned = message.mentions.has(client.user!);
    
    console.log(`[discord] message received: DM=${isDM}, Mentioned=${isMentioned}, Content="${message.content}"`);

    if (!isDM && !isMentioned) return;

    let prompt = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!prompt) return;

    // Use Author ID as queue key (ensures one process at a time per person)
    const userId = message.author.id;
    const previousTask = processingQueue.get(userId) || Promise.resolve();

    const newTask = (async () => {
        await previousTask; // Wait for the previous message to finish

        let reply: Message | null = null;
        let isCreatingReply = false;

        const updateUI = async (result: any) => {
            const skillsText = result.skills.length > 0 ? `Skills: ${result.skills.map((s: string) => `\`${s}\``).join(' ')}` : null;
            const toolsText = result.tools.length > 0 ? `Tools: ${result.tools.map((t: string) => `\`${t}\``).join(' ')}` : null;
            const usageText = `Model: \`${result.usage.model}\` | Context: \`${result.usage.current.toLocaleString()}\` / \`${result.usage.max.toLocaleString()}\` (\`${result.usage.percent}%\`)`;

            const statusLines = [skillsText, toolsText, usageText].filter(Boolean);

            const embed = new EmbedBuilder()
                .setDescription(`${result.text}${logger.formatForDiscord()}\n\n${statusLines.join('\n')}`)
                .setColor(THEME.ORANGE);

            if (!reply && !isCreatingReply) {
                isCreatingReply = true;
                try {
                    reply = await message.reply({ embeds: [embed] });
                } finally {
                    isCreatingReply = false;
                }
            } else if (reply) {
                await reply.edit({ embeds: [embed] }).catch(() => {});
            }
        };

        try {
            await message.channel.sendTyping().catch(() => {});
            const finalResult = await chat(message.author.id, prompt, message.author.username, (intermediate) => {
                updateUI(intermediate).catch(console.error);
            });
            await updateUI(finalResult);
        } catch (e: any) {
            console.error(`[discord] chat error:`, e);
            const errorEmbed = new EmbedBuilder()
                .setDescription(`error: ${e.message || 'something went wrong'}`)
                .setColor(THEME.RED);
            if (reply) await (reply as Message).edit({ embeds: [errorEmbed] });
            else await message.reply({ embeds: [errorEmbed] });
        }
    })();

    // Update the queue with the new task
    processingQueue.set(userId, newTask);
    
    // Cleanup queue after all tasks finish to prevent memory leaks
    newTask.finally(() => {
        if (processingQueue.get(userId) === newTask) {
            processingQueue.delete(userId);
        }
    });
});

async function registerCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = client.user?.id;
    if (!token || !clientId) return;
    const rest = new REST().setToken(token);
    try {
        await rest.put(Routes.applicationCommands(clientId), { 
            body: [
                authCommand.data.toJSON(), 
                modelCommand.data.toJSON(),
                agentCommand.data.toJSON(),
                clearCommand.data.toJSON()
            ] 
        });
        console.log('slash commands reloaded');
    } catch (error) {
        console.error(error);
    }
}

export function startBot() {
    client.login(process.env.DISCORD_TOKEN);
}

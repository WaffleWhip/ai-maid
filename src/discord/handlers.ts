import {
    StringSelectMenuInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextChannel,
    Message,
    CommandInteraction
} from 'discord.js';
import {
    loginProvider,
    setActiveProvider,
    getAllProviders,
    getProviderModels,
    getSelectedModel,
    setSelectedModel,
    getActiveProvider,
    shouldSkipPrompt,
    setActiveAgent,
    getActiveAgent
} from '../provider';
import { clearSession } from '../chat';
import { THEME } from './constants';

const activeLoginSessions = new Map<string, string>();

export async function handleClearSession(interaction: CommandInteraction) {
    try {
        await interaction.deferReply({ flags: 64 });
        await clearSession();
        const embed = new EmbedBuilder()
            .setTitle('ai-maid session')
            .setDescription('conversation history has been cleared.')
            .setColor(THEME.ORANGE)
            .setFooter({ text: 'ai-maid orchestration' });

        await interaction.editReply({ embeds: [embed] });
    } catch (e: any) {
        console.error(`[discord] clear session error:`, e);
        if (interaction.isRepliable()) await interaction.editReply({ content: `failed to clear session: ${e.message}` });
    }
}

export async function handleAgentSelection(interaction: StringSelectMenuInteraction | CommandInteraction) {
    let agentName: string;

    if (interaction.isChatInputCommand()) {
        await interaction.deferReply({ flags: 64 });
        agentName = (interaction as any).options.getString('name');
    } else if (interaction.isStringSelectMenu()) {
        agentName = interaction.values[0];
    } else {
        return;
    }

    if (!agentName) {
        if (interaction.isRepliable()) await interaction.editReply({ content: "no agent name provided." });
        return;
    }

    setActiveAgent(agentName);

    const embed = new EmbedBuilder()
        .setTitle('ai-maid agent selection')
        .setDescription(`successfully set active agent to \`${agentName}\``)
        .setColor(THEME.ORANGE)
        .setFooter({ text: 'ai-maid orchestration' });

    if (interaction.isStringSelectMenu()) {
        await interaction.update({ embeds: [embed], components: [] });
    } else {
        await interaction.editReply({ embeds: [embed] });
    }
}

export async function handleModelMenuUpdate(interaction: StringSelectMenuInteraction) {
    const providerId = interaction.values[0];
    const models = getProviderModels(providerId);
    const selectedModel = getSelectedModel(providerId);

    setActiveProvider(providerId);

    const embed = new EmbedBuilder()
        .setTitle('ai-maid model selection')
        .setDescription(`provider: \`${providerId}\`
current model: \`${selectedModel || 'none selected'}\`

please choose a model for this provider below.`)
        .setColor(THEME.ORANGE)
        .setFooter({ text: 'ai-maid orchestration' });

    const modelOptions = models.length > 0
        ? models.slice(0, 25).map(m => new StringSelectMenuOptionBuilder().setLabel(m.name || m.id).setValue(m.id))
        : [new StringSelectMenuOptionBuilder().setLabel('no models available').setValue('none')];

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('select_model').setPlaceholder('choose model...').addOptions(modelOptions)
    );

    await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleModelSelection(interaction: StringSelectMenuInteraction) {
    const modelId = interaction.values[0];
    const desc = interaction.message.embeds[0].description || '';
    const match = desc.match(/provider: `(.*?)`/);
    const providerId = match ? match[1] : getActiveProvider();

    setSelectedModel(providerId, modelId);

    const embed = new EmbedBuilder()
        .setTitle('ai-maid model selection')
        .setDescription(`successfully set model to \`${modelId}\` for \`${providerId}\``)
        .setColor(THEME.GREEN)
        .setFooter({ text: 'ai-maid orchestration' });

    await interaction.update({ embeds: [embed], components: [] });

    setTimeout(async () => {
        const refreshedModel = getSelectedModel(providerId);
        const resetEmbed = new EmbedBuilder()
            .setTitle('ai-maid model selection')
            .setDescription(`active provider: \`${providerId}\`
current model: \`${refreshedModel || 'none selected'}\``)
            .setColor(THEME.ORANGE)
            .setFooter({ text: 'ai-maid orchestration' });
        await interaction.editReply({ embeds: [resetEmbed], components: [] }).catch(() => { });
    }, 3000);
}

export async function handleProviderSelection(interaction: StringSelectMenuInteraction) {
    const providerId = interaction.values[0];
    const userId = interaction.user.id;
    activeLoginSessions.set(userId, providerId);
    setActiveProvider(providerId);

    const allProviders = getAllProviders();
    const authenticatedProviders = allProviders.filter(p => p.authenticated);

    const select = new StringSelectMenuBuilder()
        .setCustomId('select_provider')
        .setPlaceholder('choose provider...')
        .addOptions(allProviders.map(p =>
            new StringSelectMenuOptionBuilder()
                .setLabel(p.name)
                .setValue(p.id)
                .setDescription(p.authenticated ? 'currently authenticated' : 'requires login')
        ));
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    const embed = new EmbedBuilder()
        .setTitle('ai-maid authentication')
        .setDescription(`initiating flow for \`${providerId}\`...
authenticated: **${authenticatedProviders.length > 0 ? authenticatedProviders.map(p => p.name).join(', ') : 'none'}**`)
        .setColor(THEME.ORANGE);

    await interaction.update({ embeds: [embed], components: [row] });

    const success = await loginProvider(
        providerId,
        async (url, instructions) => {
            if (activeLoginSessions.get(userId) !== providerId) return;
            const authEmbed = new EmbedBuilder()
                .setTitle('ai-maid authentication')
                .setDescription((instructions || `please visit the link below to authenticate`) + `

provider: \`${providerId}\`
link: ${url}`)
                .setURL(url).setColor(THEME.ORANGE);
            await interaction.editReply({ embeds: [authEmbed], components: [row] });
        },
        async () => {
            if (activeLoginSessions.get(userId) !== providerId) return '';
            const inputEmbed = new EmbedBuilder()
                .setTitle('ai-maid authentication')
                .setDescription(`waiting for manual input for \`${providerId}\`. paste the code or url from your browser here.`)
                .setColor(THEME.ORANGE);
            await interaction.editReply({ embeds: [inputEmbed], components: [row] });
            const channel = interaction.channel as TextChannel;
            if (!channel) return '';
            const collector = channel.createMessageCollector({ filter: (m: Message) => m.author.id === userId, time: 120000, max: 1 });
            return new Promise<string>((resolve) => {
                collector.on('collect', (m: Message) => { m.delete().catch(() => { }); resolve(m.content.trim()); });
                collector.on('end', (collected) => { if (collected.size === 0) resolve(''); });
            });
        },
        async (options) => {
            if (shouldSkipPrompt(providerId) || activeLoginSessions.get(userId) !== providerId) return options.defaultValue || '';
            const promptEmbed = new EmbedBuilder()
                .setTitle('ai-maid authentication')
                .setDescription(options.message + `

provider: \`${providerId}\``)
                .setColor(THEME.ORANGE);
            await interaction.editReply({ embeds: [promptEmbed], components: [row] });
            const channel = interaction.channel as TextChannel;
            if (!channel) return options.defaultValue || '';
            const collector = channel.createMessageCollector({ filter: (m: Message) => m.author.id === userId, time: 60000, max: 1 });
            return new Promise<string>((resolve) => {
                collector.on('collect', (m: Message) => { m.delete().catch(() => { }); resolve(m.content.trim()); });
                collector.on('end', (collected) => { if (collected.size === 0) resolve(options.defaultValue || ''); });
            });
        }
    );

    if (activeLoginSessions.get(userId) === providerId) {
        const finalEmbed = new EmbedBuilder()
            .setTitle('ai-maid authentication')
            .setDescription(success ? `successfully authenticated \`${providerId}\`` : `failed to authenticate \`${providerId}\``)
            .setColor(success ? THEME.GREEN : THEME.RED);
        await interaction.editReply({ embeds: [finalEmbed], components: [row] });
        setTimeout(async () => {
            if (activeLoginSessions.get(userId) === providerId) {
                const refreshedProviders = getAllProviders();
                const authList = refreshedProviders.filter(p => p.authenticated);
                const cleanEmbed = new EmbedBuilder()
                    .setTitle('ai-maid authentication')
                    .setDescription(`select a provider to manage authentication

authenticated: **${authList.length > 0 ? authList.map(p => p.name).join(', ') : 'none'}**`)
                    .setColor(THEME.ORANGE);
                await interaction.editReply({ embeds: [cleanEmbed], components: [row] }).catch(() => { });
            }
        }, 5000);
    }
}

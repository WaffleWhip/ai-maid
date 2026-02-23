import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    CommandInteraction,
    MessageFlags
} from 'discord.js';
import { getAllProviders, getActiveProvider, getSelectedModel, getAvailableAgents, getActiveAgent } from '../provider';
import { THEME } from './constants';

export const agentCommand = {
    data: new SlashCommandBuilder()
        .setName('agent')
        .setDescription('select which agent to talk to')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('manually type agent name (optional)')
                .setRequired(false)
        ),

    async execute(interaction: CommandInteraction) {
        const availableAgents = getAvailableAgents();
        const activeAgent = getActiveAgent();

        const embed = new EmbedBuilder()
            .setTitle('ai-maid agent selection')
            .setDescription(`current agent: **${activeAgent}**\n\nselect an agent from the menu or use the command option to set one manually.`)
            .setColor(THEME.ORANGE)
            .setFooter({ text: 'ai-maid orchestration' });

        const select = new StringSelectMenuBuilder()
            .setCustomId('select_agent')
            .setPlaceholder('choose agent...')
            .addOptions(
                availableAgents.map(name =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(name)
                        .setValue(name)
                        .setDefault(name === activeAgent)
                )
            );

        await interaction.reply({
            embeds: [embed],
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
            flags: MessageFlags.Ephemeral
        });
    }
};

export const clearCommand = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('clear the current chat session'),

    async execute(interaction: CommandInteraction) {
        // Implementation will be handled in handlers.ts
    }
};

export const authCommand = {
    data: new SlashCommandBuilder()
        .setName('auth')
        .setDescription('authenticate ai providers'),

    async execute(interaction: CommandInteraction) {
        const allProviders = getAllProviders();
        const authenticatedProviders = allProviders.filter(p => p.authenticated);

        const embed = new EmbedBuilder()
            .setTitle('ai-maid authentication')
            .setDescription('select a provider from the menu to authenticate or switch active agent')
            .setColor(THEME.ORANGE)
            .addFields({
                name: 'authenticated',
                value: authenticatedProviders.length > 0
                    ? authenticatedProviders.map(p => `- ${p.name}`).join('\n')
                    : 'none',
                inline: false
            })
            .setFooter({ text: 'ai-maid orchestration' });

        const select = new StringSelectMenuBuilder()
            .setCustomId('select_provider')
            .setPlaceholder('choose provider...')
            .addOptions(
                allProviders.map(p =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(p.name)
                        .setValue(p.id)
                        .setDescription(p.authenticated ? 'currently authenticated' : 'requires login')
                )
            );

        await interaction.reply({
            embeds: [embed],
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
            flags: MessageFlags.Ephemeral
        });
    }
};

export const modelCommand = {
    data: new SlashCommandBuilder()
        .setName('model')
        .setDescription('select ai provider and model'),

    async execute(interaction: CommandInteraction) {
        const activeProviderId = getActiveProvider();
        const selectedModel = getSelectedModel(activeProviderId);
        const allProviders = getAllProviders();

        const embed = new EmbedBuilder()
            .setTitle('ai-maid model selection')
            .setDescription(`active provider: \`${activeProviderId}\`\ncurrent model: \`${selectedModel || 'none selected'}\`\n\nselect a provider to change its model.`)
            .setColor(THEME.ORANGE)
            .setFooter({ text: 'ai-maid orchestration' });

        const providerSelect = new StringSelectMenuBuilder()
            .setCustomId('select_provider_model')
            .setPlaceholder('choose provider...')
            .addOptions(
                allProviders.map(p =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(p.name)
                        .setValue(p.id)
                )
            );

        await interaction.reply({
            embeds: [embed],
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(providerSelect)],
            flags: MessageFlags.Ephemeral
        });
    }
};

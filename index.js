const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField,
  Collection
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// مسار الإعدادات
const configPath = path.join(__dirname, 'config.json');

// تحميل أو إنشاء الإعدادات
async function loadConfig() {
  try {
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    const defaultConfig = {
      token: "",
      prefix: "-",
      taxChannels: {}
    };
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log("تم إنشاء ملف config.json. يرجى إضافة التوكن ثم إعادة تشغيل البوت.");
    process.exit();
  }
}

// حفظ الإعدادات
async function saveConfig(config) {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

// البوت الرئيسي
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let config;
const cooldowns = new Collection();

client.once('clientReady', async () => {
  console.log(`${client.user.tag} يعمل الآن!`);
  config = await loadConfig();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // أمر panel
  if (message.content === `${config.prefix}tax`) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("تحتاج إلى صلاحية الأدمنستراتور لاستخدام هذا الأمر.");
    }

    const embed = new EmbedBuilder()
      .setTitle("لوحة التحكم")
      .setDescription("من خلال هذه القائمة يمكنك التحكم في إعدادات الضريبة.")
      .setColor("#808080")
      .setThumbnail(message.guild.iconURL({ dynamic: true, size: 128 }))
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('controlMenu')
      .setPlaceholder('اختر إعداداً...')
      .addOptions([
        { label: 'إضافة شات ضريبة', value: 'addTaxChannel' },
        { label: 'إزالة شات ضريبة', value: 'removeTaxChannel' },
        { label: 'عرض الشاتات', value: 'showTaxChannels' },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // نظام الضريبة التلقائي
  const taxChannel = config.taxChannels[message.channel.id];
  if (taxChannel && !isNaN(message.content)) {
    const amount = parseFloat(message.content);
    const tax = Math.ceil(amount / (1 - 5 / 100));
    const taxOnly = tax - amount;

    const embed = new EmbedBuilder()
      .setColor("#808080")
      .setThumbnail(message.guild.iconURL({ dynamic: true, size: 128 }))
      .setDescription(
        `**المبلغ:** ${amount}\n**الضريبة:** ${taxOnly}\n**الإجمالي مع الضريبة:** ${tax}`
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: "تحتاج إلى صلاحية الأدمنستراتور للتحكم.",
      ephemeral: true
    });
  }

  const method = interaction.values[0];

  if (method === 'addTaxChannel') {
    await addTaxChannel(interaction);
  } else if (method === 'removeTaxChannel') {
    await removeTaxChannel(interaction);
  } else if (method === 'showTaxChannels') {
    await showTaxChannels(interaction);
  }
});

async function addTaxChannel(interaction) {
  await interaction.reply({
    content: "أرسل ID القناة التي تريد إضافتها كنظام ضريبة:",
    ephemeral: true
  });

  try {
    const collected = await interaction.channel.awaitMessages({
      filter: m => m.author.id === interaction.user.id,
      max: 1,
      time: 30000
    });

    const message = collected.first();
    const channelId = message.content.trim();
    const channel = interaction.guild.channels.cache.get(channelId);

    if (!channel) {
      await message.reply("لم يتم العثور على قناة بهذا الـID.");
      return;
    }

    config.taxChannels[channelId] = true;
    await saveConfig(config);
    await message.delete();

    await interaction.followUp({
      content: `تمت إضافة القناة ${channel.name} إلى نظام الضريبة.`,
      ephemeral: true
    });

  } catch {
    await interaction.followUp({
      content: "انتهى الوقت المحدد.",
      ephemeral: true
    });
  }
}

async function removeTaxChannel(interaction) {
  await interaction.reply({
    content: "أرسل ID القناة التي تريد إزالتها من نظام الضريبة:",
    ephemeral: true
  });

  try {
    const collected = await interaction.channel.awaitMessages({
      filter: m => m.author.id === interaction.user.id,
      max: 1,
      time: 30000
    });

    const message = collected.first();
    const channelId = message.content.trim();

    if (!config.taxChannels[channelId]) {
      await message.reply("هذه القناة غير مضافة في نظام الضريبة.");
      return;
    }

    delete config.taxChannels[channelId];
    await saveConfig(config);
    await message.delete();

    await interaction.followUp({
      content: `تمت إزالة القناة من نظام الضريبة.`,
      ephemeral: true
    });

  } catch {
    await interaction.followUp({
      content: "انتهى الوقت المحدد.",
      ephemeral: true
    });
  }
}

async function showTaxChannels(interaction) {
  const channels = Object.keys(config.taxChannels);

  if (channels.length === 0) {
    return interaction.reply({
      content: "لا توجد قنوات مضافة لنظام الضريبة حالياً.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("القنوات المضافة لنظام الضريبة")
    .setColor("#808080")
    .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 128 }))
    .setDescription(channels.map(id => `• <#${id}>`).join('\n'))
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

// تشغيل البوت
async function startBot() {
  config = await loadConfig();

  if (!config.token) {
    console.log("يرجى إضافة التوكن في ملف config.json ثم إعادة تشغيل البوت.");
    process.exit();
  }

  client.login(config.token).catch(error => {
    console.error('فشل في تسجيل الدخول:', error);
    process.exit(1);
  });
}

startBot();

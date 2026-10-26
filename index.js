const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');

// ==================== الإعدادات ====================

const TOKEN = process.env.DISCORD_TOKEN;

const ALLOWED_ROLES = [
  '1543630453645385728',
  '1556066948025155635',
  '1564226573354274897',
  '1517287314492096572'
];

const TEMP_BAN_ROLES = [
  '1564225591299940493',
  '1564225591299940493'
];

const PERM_BAN_ROLES = [
  '1511773617275277422',
  '1564225792974524507'
];

const LOG_CHANNELS = [
  '1536911219959664721',
  '1564241032390901810'
];

// ==================== حفظ الباند المؤقت ====================

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'cases.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]');
}

function getCases() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveCases(cases) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cases, null, 2));
}

// ==================== إنشاء البوت ====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

function hasPermission(member) {
  return member &&
    ALLOWED_ROLES.some(id => member.roles.cache.has(id));
}

async function findMember(guild, text) {
  const id = String(text).match(/\d{17,20}/)?.[0];
  if (!id) return null;

  return guild.members.fetch(id).catch(() => null);
}

// ==================== اللوقات ====================

async function sendLog(guild, title, color, fields) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(fields)
    .setTimestamp()
    .setFooter({ text: 'نظام الرقابة الإدارية' });

  for (const channelId of LOG_CHANNELS) {
    const channel = await guild.channels
      .fetch(channelId)
      .catch(() => null);

    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(console.error);
    }
  }
}

// ==================== النماذج ====================

function textField(id, label, placeholder, paragraph = false) {
  return new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setPlaceholder(placeholder)
    .setStyle(
      paragraph
        ? TextInputStyle.Paragraph
        : TextInputStyle.Short
    )
    .setRequired(true)
    .setMaxLength(paragraph ? 800 : 100);
}

function createModal(type) {
  const modal = new ModalBuilder();

  const memberField = textField(
    'member',
    'آيدي العضو أو منشنه',
    '123456789012345678'
  );

  const reasonField = textField(
    'reason',
    'السبب',
    'اكتب السبب هنا',
    true
  );

  const durationField = textField(
    'duration',
    'مدة الباند',
    'مثال: 30m أو 2h أو 3d'
  );

  const configs = {
    temp: {
      title: 'محاسبة عضو',
      fields: [memberField, durationField, reasonField]
    },
    permanent: {
      title: 'باند نهائي',
      fields: [memberField, reasonField]
    },
    untemp: {
      title: 'فك باند مؤقت',
      fields: [memberField, reasonField]
    },
    unperm: {
      title: 'فك باند نهائي',
      fields: [memberField, reasonField]
    },
    summon: {
      title: 'استدعاء عضو',
      fields: [memberField, reasonField]
    }
  };

  const config = configs[type];
  modal.setCustomId(`form_${type}`);
  modal.setTitle(config.title);

  for (const field of config.fields) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(field)
    );
  }

  return modal;
}

// ==================== بانل الرقابة ====================

function createPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ لوحة الرقابة الإدارية')
    .setDescription(
      'اختر الإجراء المطلوب من القائمة أدناه.\n\n' +
      '🔶 محاسبة عضو: باند مؤقت.\n' +
      '🔴 باند نهائي: إضافة رتب الباند النهائي.\n' +
      '🟢 فك باند مؤقت: إزالة رتب الباند المؤقت.\n' +
      '🟢 فك باند نهائي: إزالة رتب الباند النهائي.\n' +
      '🔵 استدعاء عضو: إرسال تنبيه خاص.'
    )
    .setColor(0x263a63)
    .setFooter({ text: 'نظام الرقابة' });

  const select = new StringSelectMenuBuilder()
    .setCustomId('mod_action')
    .setPlaceholder('اختر الإجراء المطلوب...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('محاسبة عضو')
        .setDescription('باند مؤقت')
        .setValue('temp')
        .setEmoji('🔶'),

      new StringSelectMenuOptionBuilder()
        .setLabel('باند نهائي')
        .setDescription('إضافة رتب الباند النهائي')
        .setValue('permanent')
        .setEmoji('🔴'),

      new StringSelectMenuOptionBuilder()
        .setLabel('فك باند مؤقت')
        .setDescription('إزالة رتب الباند المؤقت')
        .setValue('untemp')
        .setEmoji('🟢'),

      new StringSelectMenuOptionBuilder()
        .setLabel('فك باند نهائي')
        .setDescription('إزالة رتب الباند النهائي')
        .setValue('unperm')
        .setEmoji('🟢'),

      new StringSelectMenuOptionBuilder()
        .setLabel('استدعاء عضو')
        .setDescription('إرسال تنبيه خاص')
        .setValue('summon')
        .setEmoji('🔵')
    );

  const row = new ActionRowBuilder().addComponents(select);

  return {
    embeds: [embed],
    components: [row]
  };
}

// ==================== قراءة مدة الباند ====================

function durationMs(text) {
  const match = text.trim().toLowerCase().match(
    /^(\d+)\s*(m|min|دقيقة|دقائق|h|hr|ساعة|ساعات|d|day|days|يوم|أيام|w|week|weeks|أسبوع|اسبوع|أسابيع)$/
  );

  if (!match) return null;

  const n = Number(match[1]);
  if (!Number.isSafeInteger(n) || n < 1) return null;

  const unit = match[2];
  let multiplier;

  if (['m', 'min', 'دقيقة', 'دقائق'].includes(unit)) {
    multiplier = 60000;
  } else if (['h', 'hr', 'ساعة', 'ساعات'].includes(unit)) {
    multiplier = 3600000;
  } else if (['d', 'day', 'days', 'يوم', 'أيام'].includes(unit)) {
    multiplier = 86400000;
  } else {
    multiplier = 604800000;
  }

  const result = n * multiplier;

  if (!Number.isSafeInteger(result) ||
      result > 365 * 86400000) {
    return null;
  }

  return result;
}

// ==================== انتهاء الباند المؤقت ====================

async function checkExpiredBans() {
  const cases = getCases();
  const remaining = [];
  const now = Date.now();

  for (const item of cases) {
    if (item.expiresAt > now) {
      remaining.push(item);
      continue;
    }

    try {
      const guild = await client.guilds.fetch(item.guildId);
      const member = await guild.members.fetch(item.memberId);

      const removable = item.roles.filter(id =>
        member.roles.cache.has(id)
      );

      if (removable.length) {
        await member.roles.remove(
          removable,
          'انتهاء مدة الباند المؤقت'
        );
      }

      await sendLog(
        guild,
        'انتهاء الباند المؤقت',
        0x57f287,
        [
          {
            name: 'العضو',
            value: `<@${item.memberId}>`
          },
          {
            name: 'السبب الأصلي',
            value: item.reason
          },
          {
            name: 'الحالة',
            value: 'انتهت المدة وأزيلت رتب الباند'
          }
        ]
      );
    } catch (error) {
      console.error('تعذر إنهاء الباند:', error);
      remaining.push(item);
    }
  }

  saveCases(remaining);
}

// ==================== تشغيل البوت ====================

client.once('ready', () => {
  console.log(`تم تشغيل البوت: ${client.user.tag}`);

  checkExpiredBans();
  setInterval(checkExpiredBans, 60000);
});

// ==================== أوامر البانل ====================

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const command = message.content.trim();

  if (command !== '-رقابة' && command !== '-رقابه') {
    return;
  }

  if (!hasPermission(message.member)) {
    return message.reply('❌ ليس لديك صلاحية استخدام البانل.');
  }

  await message.channel.send(createPanel());
});

// ==================== الأزرار والنماذج ====================

client.on('interactionCreate', async interaction => {
  try {
    if (!interaction.isStringSelectMenu() && !interaction.isModalSubmit()) {
      return;
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: 'هذا الإجراء متاح داخل السيرفر فقط.',
        ephemeral: true
      });
    }

    const actor = await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => null);

    if (!hasPermission(actor)) {
      return interaction.reply({
        content: '❌ ليس لديك صلاحية استخدام هذا النظام.',
        ephemeral: true
      });
    }

    // فتح النماذج من القائمة
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== 'mod_action') return;

      const type = interaction.values[0];

      return interaction.showModal(createModal(type));
    }

    // معالجة النماذج
    const type = interaction.customId.replace('form_', '');

    await interaction.deferReply({ ephemeral: true });

    const memberText = interaction.fields.getTextInputValue('member');
    const reason = interaction.fields.getTextInputValue('reason').trim();

    const target = await findMember(interaction.guild, memberText);

    if (!target) {
      return interaction.editReply(
        '❌ لم أجد العضو. استخدم آيدي صحيحًا أو منشن عضو موجود في السيرفر.'
      );
    }

    if (['temp', 'permanent'].includes(type) &&
        target.id === interaction.user.id) {
      return interaction.editReply('❌ لا يمكنك تطبيق الباند على نفسك.');
    }

    if (target.id === client.user.id) {
      return interaction.editReply('❌ لا يمكن تطبيق هذا الإجراء على البوت.');
    }

    // محاسبة عضو: باند مؤقت أو نهائي
    if (type === 'temp' || type === 'permanent') {
      let roles = type === 'temp' ? TEMP_BAN_ROLES : PERM_BAN_ROLES;
      let expiresAt = null;
      let durationText = '';

      if (type === 'temp') {
        durationText = interaction.fields.getTextInputValue('duration');
        const ms = durationMs(durationText);

        if (!ms) {
          return interaction.editReply(
            '❌ المدة غير صحيحة. أمثلة: `30m` أو `2h` أو `3d` أو `1w`.'
          );
        }

        expiresAt = Date.now() + ms;
      }

      const missing = roles.filter(id =>
        !interaction.guild.roles.cache.has(id)
      );

      if (missing.length) {
        return interaction.editReply(
          `❌ الرتب التالية غير موجودة في السيرفر: ${missing.join(', ')}`
        );
      }

      const botMember = interaction.guild.members.me;

      const tooHigh = roles.some(id =>
        interaction.guild.roles.cache.get(id).position >=
        botMember.roles.highest.position
      );

      if (tooHigh) {
        return interaction.editReply(
          '❌ رتبة البوت يجب أن تكون أعلى من رتب الباند.'
        );
      }

      try {
        await target.roles.add(roles, reason);
      } catch (error) {
        console.error(error);
        return interaction.editReply(
          '❌ فشلت إضافة الرتب. تأكد من صلاحية Manage Roles وترتيب الرتب.'
        );
      }

      if (type === 'temp') {
        const cases = getCases();

        cases.push({
          guildId: interaction.guild.id,
          memberId: target.id,
          roles,
          reason,
          expiresAt
        });

        saveCases(cases);
      }

      const fields = [
        {
          name: 'العضو',
          value: `${target.user.tag} (<@${target.id}>)`
        },
        {
          name: 'المنفّذ',
          value: `<@${interaction.user.id}>`
        },
        {
          name: 'الرتب المضافة',
          value: roles.map(id => `<@&${id}>`).join('\n')
        },
        {
          name: 'السبب',
          value: reason
        }
      ];

      if (expiresAt) {
        fields.push(
          { name: 'المدة', value: durationText },
          {
            name: 'وقت الانتهاء',
            value: `<t:${Math.floor(expiresAt / 1000)}:F>`
          }
        );
      }

      await sendLog(
        interaction.guild,
        type === 'temp' ? 'محاسبة عضو - باند مؤقت' : 'باند نهائي',
        type === 'temp' ? 0xfee75c : 0xed4245,
        fields
      );

      return interaction.editReply(
        `✅ تم تنفيذ الإجراء على <@${target.id}>.`
      );
    }

    // فك الباند
    if (type === 'untemp' || type === 'unperm') {
      const roles = type === 'untemp' ? TEMP_BAN_ROLES : PERM_BAN_ROLES;

      const found = roles.filter(id =>
        target.roles.cache.has(id)
      );

      if (!found.length) {
        return interaction.editReply(
          'ℹ️ العضو لا يحمل رتب هذا النوع من الباند.'
        );
      }

      try {
        await target.roles.remove(found, reason);
      } catch (error) {
        console.error(error);
        return interaction.editReply(
          '❌ فشلت إزالة الرتب. تحقق من صلاحيات البوت وترتيب الرتب.'
        );
      }

      if (type === 'untemp') {
        saveCases(
          getCases().filter(item =>
            !(item.guildId === interaction.guild.id &&
              item.memberId === target.id)
          )
        );
      }

      await sendLog(
        interaction.guild,
        type === 'untemp' ? 'فك باند مؤقت' : 'فك باند نهائي',
        0x57f287,
        [
          { name: 'العضو', value: `<@${target.id}> (${target.id})` },
          { name: 'المنفّذ', value: `<@${interaction.user.id}>` },
          { name: 'الرتب التي أزيلت', value: found.map(id => `<@&${id}>`).join('\n') },
          { name: 'السبب', value: reason }
        ]
      );

      return interaction.editReply(
        `✅ تمت إزالة رتب الباند من <@${target.id}>.`
      );
    }

    // استدعاء عضو
    if (type === 'summon') {
      const embed = new EmbedBuilder()
        .setTitle('📣 استدعاء إداري')
        .setDescription(
          `تم استدعاؤك من إدارة السيرفر.\n\n**السبب:** ${reason}`
        )
        .setColor(0x5865f2)
        .setTimestamp();

      let sent = true;

      try {
        await target.send({ embeds: [embed] });
      } catch {
        sent = false;
      }

      await sendLog(
        interaction.guild,
        'استدعاء عضو',
        0x5865f2,
        [
          { name: 'العضو', value: `<@${target.id}> (${target.id})` },
          { name: 'المنفّذ', value: `<@${interaction.user.id}>` },
          { name: 'السبب', value: reason },
          {
            name: 'رسالة الخاص',
            value: sent ? 'تم إرسالها بنجاح' : 'تعذر الإرسال؛ الخاص مغلق أو غير متاح'
          }
        ]
      );

      return interaction.editReply(
        sent
          ? '✅ تم إرسال الاستدعاء وتسجيله في اللوقات.'
          : '⚠️ تعذر إرسال الخاص، لكن تم تسجيل الاستدعاء في اللوقات.'
      );
    }
  } catch (error) {
    console.error('خطأ في معالجة التفاعل:', error);

    const message = 'حدث خطأ غير متوقع. راجع سجلات الاستضافة.';

    if (interaction.isRepliable()) {
      if (interaction.deferred) {
        await interaction.editReply(message).catch(() => {});
      } else if (!interaction.replied) {
        await interaction.reply({
          content: message,
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
});

// ==================== تسجيل الدخول ====================

if (!TOKEN) {
  console.error('لم يتم ضبط DISCORD_TOKEN في متغيرات البيئة.');
  process.exit(1);
}

client.login(TOKEN);
// Ежедневная проверка расходников + отправка напоминаний в Telegram.
// Вызывается автоматически по расписанию из vercel.json (Vercel Cron).
// Нужны переменные окружения в настройках проекта на Vercel:
//   APPS_SCRIPT_URL     — URL развёрнутого Google Apps Script Web App
//   TELEGRAM_BOT_TOKEN  — токен бота от @BotFather
//   TELEGRAM_CHAT_ID    — ваш chat_id (см. README)

export default async function handler(req, res) {
  const { APPS_SCRIPT_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  if (!APPS_SCRIPT_URL || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({ ok: false, error: 'missing_env_vars' });
  }

  try {
    const listResp = await fetch(APPS_SCRIPT_URL);
    const listData = await listResp.json();
    if (!listData.ok) throw new Error('apps_script_read_failed');

    const today = new Date().toISOString().slice(0, 10);
    const due = [];

    for (const it of listData.items) {
      const { daysLeft, status } = computeStatus(it);
      if (status === 'ok') continue;
      if (it.lastNotified === today) continue; // уже напоминали сегодня
      due.push({ it, daysLeft, status });
    }

    if (due.length > 0) {
      const lines = due.map(({ it, daysLeft }) => {
        const when = daysLeft < 0
          ? `просрочено на ${Math.abs(daysLeft)} дн.`
          : `осталось ${daysLeft} дн.`;
        return `• ${it.name} — ${when}`;
      });
      const text = `Пора пополнить запас:\n\n${lines.join('\n')}`;
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, text);

      for (const { it } of due) {
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'markNotified', id: it.id, date: today })
        });
      }
    }

    return res.status(200).json({ ok: true, notified: due.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

function computeStatus(item) {
  const start = new Date(item.start);
  const end = new Date(item.end);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((end - today) / 86400000);
  let status = 'ok';
  if (daysLeft < 0) status = 'urgent';
  else if (daysLeft <= Number(item.notify)) status = daysLeft <= 3 ? 'urgent' : 'soon';
  return { daysLeft, status };
}

async function sendTelegram(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

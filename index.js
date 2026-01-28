export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      try {
        const update = await request.json();
        if (update.message) {
          const chatId = update.message.chat.id;
          const text = update.message.text;

          // Start Command - ခလုတ်တွေ ပေါ်လာမယ်
          if (text === "/start") {
            const welcomeMsg = "Karo Factory မှ ကြိုဆိုပါတယ် သားကြီး!\n\nအောက်က ခလုတ်တွေကို သုံးပြီး စမ်းကြည့်နိုင်ပါတယ်။";
            const keyboard = {
              keyboard: [
                [{ text: "My Wallet" }, { text: "History" }],
                [{ text: "Referral" }, { text: "Help" }]
              ],
              resize_keyboard: true
            };
            await sendMessage(chatId, welcomeMsg, keyboard, env.BOT_TOKEN);
          }

          // Wallet ခလုတ် စမ်းသပ်ချက်
          if (text === "My Wallet") {
            await sendMessage(chatId, "သင်၏ လက်ရှိလက်ကျန်ငွေမှာ 0 Ks ဖြစ်ပါသည်။", null, env.BOT_TOKEN);
          }
        }
      } catch (e) {
        return new Response("Error: " + e.message);
      }
    }
    return new Response("OK");
  }
};

async function sendMessage(chatId, text, keyboard = null, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    reply_markup: keyboard ? keyboard : { remove_keyboard: true }
  };
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

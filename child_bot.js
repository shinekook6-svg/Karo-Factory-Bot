/**
 * KARO FACTORY - Child Bot Logic Module
 */
import { tg, fsSearch, fsGet, fsUpdate } from './firebase.js';

// Function လေးတစ်ခု သီးသန့်ဆောက်ထားမယ်
async function smartEdit(chatId, messageId, text, markup, token) {
  try {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "HTML",
      reply_markup: markup
    }, token);
  } catch (e) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_markup: markup
    }, token);
  }
}

export async function handleChildBot(payload, token, env, accessToken) {
  const isMessage = !!payload.message;
  const isCallback = !!payload.callback_query;
  
  const msgId = isCallback ? payload.callback_query.message.message_id : null;
  const chatId = isMessage ? payload.message.chat.id : payload.callback_query.message.chat.id;
  const text = isMessage ? (payload.message.text || "") : "";
  const callbackData = isCallback ? payload.callback_query.data : null;

  // --- Bot Data ရှာဖွေခြင်း ---
  const botQuery = await fsSearch("child_bots", "token", token, env, accessToken);
  if (!botQuery || botQuery.length === 0 || !botQuery[0].document) return new Response("OK");

  const botData = botQuery[0].document.fields;
  const expiryDate = new Date(botData.expiry?.timestampValue);
  const isAdsDisabled = botData.ads_disabled?.booleanValue || false;
  const ownerId = botData.owner_id?.stringValue;
  const isAdmin = String(chatId) === ownerId;
  const now = new Date();

  // --- သက်တမ်းစစ်ဆေးခြင်း ---
  if (expiryDate < now) {
    const expMsg = "⚠️ <b>ဤ Bot သည် သက်တမ်းကုန်ဆုံးသွားပါပြီ။</b>\n\nပြန်လည်အသုံးပြုလိုပါက Bot ပိုင်ရှင်မှတစ်ဆင့် Karo Factory (@KaroFactory_bot) တွင် သက်တမ်းတိုးပေးပါ။";
    await tg("sendMessage", { chat_id: chatId, text: expMsg, parse_mode: "HTML" }, token);
    return new Response("OK");
  }

  const brandingAds = isAdsDisabled ? "" : "\n\n---\n🏭 <b>Powered By <a href='https://t.me/KaroFactory_bot'>Karo Factory</a></b>";

  // --- Keyboard UI ---
  const mainMenu = {
    keyboard: [
      [{ text: "(a) Items များဝယ်မည်" }, { text: "(b) ငွေဖြည့်မည်" }],
      [{ text: "(c) My Wallet" }, { text: "(d) History" }]
    ],
    resize_keyboard: true
  };
  if (isAdmin) mainMenu.keyboard.push([{ text: "(e) Admin Panel" }]);

  // --- MESSAGE HANDLING ---
  if (isMessage) {
    if (text === "/start") {
      const username = payload.message.from.username ? `@${payload.message.from.username}` : "No Username";
      await fsUpdate(`child_users/${token}_${chatId}`, { 
        username: { stringValue: username },
        last_seen: { timestampValue: new Date().toISOString() }
      }, env, accessToken);

      let startMsg = "👋 <b>မင်္ဂလာပါ!</b>\n\nဤသည်မှာ Game Shop Bot ဖြစ်ပါသည်။ သင်လိုအပ်သည်များကို အောက်ပါ Menu များမှတစ်ဆင့် ဆောင်ရွက်နိုင်ပါသည်။";
      startMsg += brandingAds;

      return await tg("sendMessage", { chat_id: chatId, text: startMsg, parse_mode: "HTML", reply_markup: mainMenu }, token);
    }

    if (text === "(c) My Wallet") {
      const walletRes = await fsGet(`child_wallets/${token}_${chatId}`, env, accessToken);
      const balance = walletRes.fields?.balance?.integerValue || 0;
      return await tg("sendMessage", { chat_id: chatId, text: `💳 <b>သင်၏ Wallet အချက်အလက်</b>\n\nလက်ကျန်ငွေ - <b>${Number(balance).toLocaleString()} Ks</b>\n\n${brandingAds}`, parse_mode: "HTML" }, token);
    }

    if (text === "(e) Admin Panel") {
      if (!isAdmin) return new Response("OK");
      return await tg("sendMessage", {
        chat_id: chatId,
        text: "⚙️ <b>Admin Control Panel</b>",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📦 Add Item", callback_data: "admin_add_item" }, { text: "✏️ Edit Items", callback_data: "admin_edit_items" }, { text: "🗑 Delete Item", callback_data: "admin_delete_items" }],
            [{ text: "💳 Payment Setup", callback_data: "admin_pay_setup" }],
            [{ text: "📥 Deposit Orders", callback_data: "admin_depo_orders" }],
            [{ text: "🎮 TopUp Orders", callback_data: "admin_topup_orders" }],
            [{ text: "📢 TopUp Done Noti Setup", callback_data: "admin_noti_setup" }],
            [{ text: "🤖 Total Users", callback_data: "admin_look_total_users" }],
            [{ text: "💎 Vip Users", callback_data: "admin_look_vip_users" }]
          ]
        }
      }, token);
    }

    if (text === "(a) Items များဝယ်မည်") {
      return await tg("sendMessage", {
        chat_id: chatId,
        text: "🎮 ဝယ်ယူလိုသော Game အမျိုးအစားကို ရွေးချယ်ပါ -",
        reply_markup: {
          inline_keyboard: [
            [{ text: "MLBB", callback_data: "buy_game_MLBB" }],
            [{ text: "PUBG", callback_data: "buy_game_PUBG" }],
            [{ text: "HOK", callback_data: "buy_game_HOK" }]
          ]
        }
      }, token);
    }

    if (text === "(b) ငွေဖြည့်မည်") {
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "awaiting_amount" } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: "💰 <b>ငွေဖြည့်မည့် ပမာဏကို ရိုက်ထည့်ပါ</b>\n\n(ဥပမာ - 5000)", parse_mode: "HTML" }, token);
    }

    // --- User Status Check ---
    const userDoc = await fsGet(`child_users/${token}_${chatId}`, env, accessToken);
    const userStatus = userDoc.fields?.status?.stringValue || "";

    if (userStatus === "awaiting_amount" && !isNaN(text) && text !== "") {
      const amount = parseInt(text);
      if (amount < 100) return await tg("sendMessage", { chat_id: chatId, text: "❌ အနည်းဆုံး ၁၀၀ ကျပ်မှ စဖြည့်ပေးပါ။" }, token);

      const payRes = await fsGet(`child_settings/${token}_payments`, env, accessToken);
      const kpay = payRes.fields?.kpay?.stringValue || "မရှိပါ";
      const wave = payRes.fields?.wave?.stringValue || "မရှိပါ";

      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "awaiting_screenshot" }, temp_amount: { integerValue: amount } }, env, accessToken);

      return await tg("sendMessage", { 
        chat_id: chatId, 
        text: `💰 <b>ငွေဖြည့်ရန် အချက်အလက်များ</b>\n\nပမာဏ - <b>${amount.toLocaleString()} Ks</b>\n\n🔹 <b>KPay:</b> ${kpay}\n🔹 <b>Wave:</b> ${wave}\n\nအထက်ပါ Account များသို့ ငွေလွှဲပြီးပါက <b>Screenshot</b> ပေးပို့ပေးပါခင်ဗျာ။`,
        parse_mode: "HTML"
      }, token);
    }

    if (userStatus === "awaiting_screenshot" && payload.message.photo) {
      const photoId = payload.message.photo.pop().file_id;
      const amount = userDoc.fields?.temp_amount?.integerValue || 0;
      const depositId = `depo_${Date.now()}`;
      const username = payload.message.from.username ? `@${payload.message.from.username}` : "No Username";

      await fsUpdate(`child_orders/${token}/deposits/${depositId}`, {
        userId: { stringValue: String(chatId) },
        username: { stringValue: username },
        amount: { integerValue: amount },
        photoId: { stringValue: photoId },
        status: { stringValue: "pending" }
      }, env, accessToken);

      await tg("sendPhoto", {
        chat_id: ownerId,
        photo: photoId,
        caption: `📥 <b>ငွေဖြည့်လွှဲစာအသစ်</b>\n\nပို့သူ: ${username} (<code>${chatId}</code>)\nပမာဏ: <b>${Number(amount).toLocaleString()} Ks</b>`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: `✅ Approve`, callback_data: `depo_app_${amount}_${chatId}_${depositId}` }],
            [{ text: "❌ Reject", callback_data: `depo_rej_${chatId}_${depositId}` }]
          ]
        }
      }, token);

      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "idle" } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: "✅ ပြေစာ လက်ခံရရှိပါသည်။ Admin မှ စစ်ဆေးပြီး အတည်ပြုပေးပါမည်။" }, token);
    }

    if (text === "(d) History") {
      const depoHist = await fsSearch(`child_orders/${token}/deposits`, "userId", String(chatId), env, accessToken);
      if (!depoHist || depoHist.length === 0) {
        return await tg("sendMessage", { chat_id: chatId, text: "📜 <b>သင်၏ ငွေဖြည့်မှတ်တမ်း</b>\n\nမှတ်တမ်း မရှိသေးပါ။", parse_mode: "HTML" }, token);
      }
      let msg = "📥 <b>သင်၏ နောက်ဆုံး ငွေဖြည့်မှတ်တမ်းများ</b>\n\n";
      const lastFive = depoHist.slice(-5).reverse(); 
      lastFive.forEach((doc, index) => {
        const d = doc.document.fields;
        const statusIcon = d.status.stringValue === "pending" ? "⏳" : (d.status.stringValue === "approved" ? "✅" : "❌");
        msg += `${index + 1}. 💰 ${Number(d.amount.integerValue).toLocaleString()} Ks - ${statusIcon} ${d.status.stringValue}\n`;
      });
      return await tg("sendMessage", { chat_id: chatId, text: msg, parse_mode: "HTML" }, token);
    }

    if (userStatus.startsWith("awaiting_no_")) {
      const type = userStatus.split("_")[2];
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: `awaiting_name_${type}` }, temp_pay_no: { stringValue: text } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: `👤 <b>${type.toUpperCase()} အကောင့်အမည် (Account Name) ရိုက်ထည့်ပါ</b>`, parse_mode: "HTML" }, token);
    }

    if (userStatus.startsWith("awaiting_name_")) {
      const type = userStatus.split("_")[2];
      const payNo = userDoc.fields?.temp_pay_no?.stringValue;
      const fullInfo = `${payNo} - ${text}`;
      await fsUpdate(`child_settings/${token}_payments`, { [type]: { stringValue: fullInfo } }, env, accessToken);
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "idle" } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: `✅ <b>${type.toUpperCase()} Setup အောင်မြင်ပါသည်။</b>\n\nသတ်မှတ်ချက်: ${fullInfo}`, parse_mode: "HTML" }, token);
    }

    if (userStatus === "awaiting_noti_channel") {
      let channelTag = text.trim();
      if (!channelTag.startsWith('@') && !channelTag.startsWith('-100')) channelTag = '@' + channelTag;
      await fsUpdate(`child_settings/${token}_settings`, { noti_channel: { stringValue: channelTag } }, env, accessToken);
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "idle" } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: `✅ <b>Setup အောင်မြင်ပါသည်။</b>\n\nယခုမှစ၍ TopUp အော်ဒါပြီးဆုံးတိုင်း <b>${channelTag}</b> ထဲသို့ Noti ပို့ပေးသွားပါမည်။\n\n⚠️ <i>မှတ်ချက် - Bot ကို Channel ထဲတွင် Admin ခန့်ထားရန် မမေ့ပါနှင့်။</i>`, parse_mode: "HTML" }, token);
    }

    if (userStatus.startsWith("adding_item_name_")) {
      const game = userStatus.split("_")[3];
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: `adding_item_price_${game}` }, temp_item_name: { stringValue: text } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: `💰 <b>${text}</b> အတွက် ဈေးနှုန်း (Ks) ရိုက်ထည့်ပါ`, parse_mode: "HTML" }, token);
    }

    if (userStatus.startsWith("adding_item_price_")) {
      const game = userStatus.split("_")[3];
      const itemName = userDoc.fields?.temp_item_name?.stringValue;
      const itemId = `item_${Date.now()}`;
      await fsUpdate(`child_items/${token}/${game}/${itemId}`, { name: { stringValue: itemName }, price: { integerValue: parseInt(text) }, game: { stringValue: game } }, env, accessToken);
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "idle" } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: `✅ ${game} ပစ္စည်း သိမ်းဆည်းပြီးပါပြီ။` }, token);
    }

    if (userStatus.startsWith("awaiting_new_price_")) {
      const parts = userStatus.split("_");
      const itemId = parts[4];
      const newPrice = parseInt(text);
      if (isNaN(newPrice)) return await tg("sendMessage", { chat_id: chatId, text: "❌ ကိန်းဂဏန်း (Number) သာ ရိုက်ထည့်ပါ။" }, token);
      await fsUpdate(`child_items/${token}/${parts[3]}/${itemId}`, { price: { integerValue: newPrice } }, env, accessToken);
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "idle" } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: `✅ ဈေးနှုန်းကို <b>${newPrice.toLocaleString()} Ks</b> သို့ ပြောင်းလဲပြီးပါပြီ။`, parse_mode: "HTML" }, token);
    }

    if (userStatus.startsWith("awaiting_gameid_")) {
      const parts = userStatus.split("_");
      const game = parts[2];
      const itemId = parts[3];
      const gameId = text;

      const itemDoc = await fsGet(`child_items/${token}/${game}/${itemId}`, env, accessToken);
      const price = parseInt(itemDoc.fields.price.integerValue);
      const itemName = itemDoc.fields.name.stringValue;

      await fsUpdate(`child_users/${token}_${chatId}`, { 
        status: { stringValue: `confirming_buy_${game}_${itemId}` },
        temp_game_id: { stringValue: gameId }
      }, env, accessToken);

      const confirmMsg = `🛒 <b>ဝယ်ယူမှုကို အတည်ပြုပါ</b>\n\n🎮 ဂိမ်း: ${game}\n📦 ပစ္စည်း: ${itemName}\n🆔 ID: <code>${gameId}</code>\n💰 ကျသင့်ငွေ: ${price.toLocaleString()} Ks`;
      return await tg("sendMessage", {
        chat_id: chatId,
        text: confirmMsg,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ အတည်ပြုသည် (ဝယ်မည်)", callback_data: `final_buy_${game}_${itemId}` }],
            [{ text: "❌ မဝယ်တော့ပါ (ဖျက်မည်)", callback_data: "cancel_buy" }]
          ]
        }
      }, token);
    }
  }

  // --- CALLBACK HANDLING ---
  if (isCallback) {
    if (callbackData === "admin_pay_setup") {
      if (!isAdmin) return new Response("OK");
      return await tg("sendMessage", {
        chat_id: chatId,
        text: "💳 <b>ဘယ် Payment ကို ပြင်ဆင်မလဲ?</b>",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "KBZ Pay", callback_data: "setup_type_kpay" }],
            [{ text: "Wave Pay", callback_data: "setup_type_wave" }]
          ]
        }
      }, token);
    }

    // 🌟 (New) Noti Setup Callback Handling
    if (callbackData === "admin_noti_setup") {
      if (!isAdmin) return new Response("OK");
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "awaiting_noti_channel" } }, env, accessToken);
      return await tg("sendMessage", {
        chat_id: chatId,
        text: "📢 <b>Channel Tag ကို ရိုက်ထည့်ပေးပါ</b>\n\n(ဥပမာ - @MyGameShopChannel)",
        parse_mode: "HTML"
      }, token);
    }

    if (callbackData.startsWith("setup_type_")) {
      const type = callbackData.split("_")[2];
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: `awaiting_no_${type}` } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: `📱 <b>${type.toUpperCase()} ဖုန်းနံပါတ် ရိုက်ထည့်ပါ</b>`, parse_mode: "HTML" }, token);
    }

    if (callbackData.startsWith("buy_game_")) {
      const game = callbackData.split("_")[2];
      const itemQuery = await fsSearch(`child_items/${token}/${game}`, "game", game, env, accessToken);
      if (!itemQuery || itemQuery.length === 0) return await tg("sendMessage", { chat_id: chatId, text: "❌ လက်ရှိတွင် ပစ္စည်းစာရင်း မရှိသေးပါ။" }, token);
      const buttons = itemQuery.map(doc => {
        const data = doc.document.fields;
        const itemId = doc.document.name.split("/").pop();
        return [{ text: `${data.name.stringValue} - ${Number(data.price.integerValue).toLocaleString()} Ks`, callback_data: `select_item_${game}_${itemId}` }];
      });
      return await tg("sendMessage", { chat_id: chatId, text: `🎮 <b>${game}</b> ပမာဏ ရွေးချယ်ပါ -`, reply_markup: { inline_keyboard: buttons } }, token);
    }

    if (callbackData.startsWith("select_item_")) {
      const parts = callbackData.split("_");
      const game = parts[2];
      const itemId = parts[3];
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: `awaiting_gameid_${game}_${itemId}` } }, env, accessToken);
      let msg = `🆔 <b>${game} Game ID ရိုက်ထည့်ပါ</b>`;
      if (game === "MLBB") msg = `🆔 <b>MLBB ID + Server ID ရိုက်ထည့်ပါ</b>\n(ဥပမာ - 12345678 1234)`;
      return await tg("sendMessage", { chat_id: chatId, text: msg, parse_mode: "HTML" }, token);
    }
    
    if (callbackData.startsWith("add_item_")) {
      const game = callbackData.split("_")[2];
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: `adding_item_name_${game}` } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: `💎 <b>${game}</b> အတွက် ပမာဏ/အမျိုးအမည် ရိုက်ထည့်ပါ\n(ဥပမာ - 86 Diamonds)`, parse_mode: "HTML" }, token);
    }

    if (callbackData === "admin_depo_orders") {
      if (!isAdmin) return new Response("OK");
      const depoQuery = await fsSearch(`child_orders/${token}/deposits`, "status", "pending", env, accessToken);
      if (!depoQuery || depoQuery.length === 0 || !depoQuery[0].document) {
        return await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "လက်ရှိ Pending Order မရှိပါ။", show_alert: true }, token);
      }
      await tg("sendMessage", { chat_id: chatId, text: "📥 <b>လက်ရှိ Pending ဖြစ်နေသော ငွေဖြည့်စာရင်းများ -</b>", parse_mode: "HTML" }, token);
      for (const doc of depoQuery) {
        const data = doc.document.fields;
        const uId = data.userId.stringValue;
        const uName = data.username?.stringValue || "No Username";
        const amt = data.amount.integerValue;
        const pId = data.photoId.stringValue;
        const depoId = doc.document.name.split("/").pop();
        await tg("sendPhoto", {
          chat_id: chatId,
          photo: pId,
          caption: `👤 User: ${uName} (<code>${uId}</code>)\n💰 Amount: ${Number(amt).toLocaleString()} Ks`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: `✅ Approve`, callback_data: `depo_app_${amt}_${uId}_${depoId}` }, { text: "❌ Reject", callback_data: `depo_rej_${uId}_${depoId}` }]]
          }
        }, token);
      }
      return new Response("OK");
    }

    if (callbackData.startsWith("depo_app_")) {
      const parts = callbackData.split("_");
      const amount = parseInt(parts[2]);
      const targetUserId = parts[3];
      const depoId = parts[4];

      const walletPath = `child_wallets/${token}_${targetUserId}`;
      const walletRes = await fsGet(walletPath, env, accessToken);
      const currentBalance = parseInt(walletRes.fields?.balance?.integerValue || 0);
      const newBalance = currentBalance + amount;
      await fsUpdate(walletPath, { balance: { integerValue: newBalance } }, env, accessToken);
      await fsUpdate(`child_orders/${token}/deposits/${depoId}`, { status: { stringValue: "approved" } }, env, accessToken);

      await tg("editMessageCaption", {
        chat_id: chatId,
        message_id: payload.callback_query.message.message_id,
        caption: `✅ <b>Approved & Wallet Updated!</b>\nAmount: ${amount.toLocaleString()} Ks\nUser: ${targetUserId}`,
        parse_mode: "HTML"
      }, token);
      return await tg("sendMessage", { chat_id: targetUserId, text: `🎉 <b>ငွေဖြည့်သွင်းမှု အောင်မြင်ပါသည်။</b>\nလက်ကျန် - ${newBalance.toLocaleString()} Ks`, parse_mode: "HTML" }, token);
    }

    if (callbackData.startsWith("depo_rej_")) {
      const parts = callbackData.split("_");
      const targetUserId = parts[2];
      const depoId = parts[3];
      await fsUpdate(`child_orders/${token}/deposits/${depoId}`, { status: { stringValue: "rejected" } }, env, accessToken);
      await tg("editMessageCaption", { chat_id: chatId, message_id: payload.callback_query.message.message_id, caption: `❌ <b>Rejected!</b>\nUser ID: ${targetUserId}`, parse_mode: "HTML" }, token);
      return await tg("sendMessage", { chat_id: targetUserId, text: "❌ <b>သင်၏ ငွေဖြည့်သွင်းမှု ပယ်ချခံရပါသည်။</b>", parse_mode: "HTML" }, token);
    }

    if (callbackData.startsWith("final_buy_")) {
      const parts = callbackData.split("_");
      const game = parts[2];
      const itemId = parts[3];

      const userDoc = await fsGet(`child_users/${token}_${chatId}`, env, accessToken);
      const gameId = userDoc.fields?.temp_game_id?.stringValue;
      const itemDoc = await fsGet(`child_items/${token}/${game}/${itemId}`, env, accessToken);
      const price = parseInt(itemDoc.fields.price.integerValue);
      const itemName = itemDoc.fields.name.stringValue;

      const walletRes = await fsGet(`child_wallets/${token}_${chatId}`, env, accessToken);
      const balance = parseInt(walletRes.fields?.balance?.integerValue || 0);

      if (balance < price) {
        return await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "❌ လက်ကျန်ငွေ မလုံလောက်တော့ပါ။", show_alert: true }, token);
      }

      const newBalance = balance - price;
      await fsUpdate(`child_wallets/${token}_${chatId}`, { balance: { integerValue: newBalance } }, env, accessToken);
      const orderId = `topup_${Date.now()}`;
      await fsUpdate(`child_orders/${token}/topups/${orderId}`, {
        userId: { stringValue: String(chatId) },
        gameId: { stringValue: gameId },
        game: { stringValue: game },
        item: { stringValue: itemName },
        price: { integerValue: price },
        status: { stringValue: "pending" },
        timestamp: { timestampValue: new Date().toISOString() }
      }, env, accessToken);

      const adminMsg = `🎮 <b>Order အသစ်!</b>\n\n📝 ID: <code>${orderId}</code>\n👤 User: <a href="tg://user?id=${chatId}">${chatId}</a>\n🎮 Game: ${game}\n🆔 ID: <code>${gameId}</code>\n📦 Item: ${itemName}\n💰 Price: ${price.toLocaleString()} Ks`;
      await tg("sendMessage", {
        chat_id: ownerId,
        text: adminMsg,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "✅ Done", callback_data: `topup_done_${chatId}_${orderId}` }, { text: "❌ Refund", callback_data: `topup_ref_${chatId}_${orderId}` }]] }
      }, token);

      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "idle" } }, env, accessToken);
      await smartEdit(chatId, msgId, `✅ <b>ဝယ်ယူမှု အောင်မြင်ပါသည်။</b>\n\nအော်ဒါ ID: ${orderId}\nကျန်ငွေ: ${newBalance.toLocaleString()} Ks\n\nAdmin မှ ခေတ္တအတွင်း TopUp ပေးပါမည်။`, null, token);
      return new Response("OK");
    }

    if (callbackData === "cancel_buy") {
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: "idle" } }, env, accessToken);
      return await tg("editMessageText", { chat_id: chatId, message_id: payload.callback_query.message.message_id, text: "❌ ဝယ်ယူမှုကို ဖျက်သိမ်းလိုက်ပါပြီ။" }, token);
    }
    
    if (callbackData.startsWith("del_list_")) {
      const game = callbackData.split("_")[2];
      const itemQuery = await fsSearch(`child_items/${token}/${game}`, "game", game, env, accessToken);
      if (!itemQuery || itemQuery.length === 0) return await tg("sendMessage", { chat_id: chatId, text: "❌ ပစ္စည်းစာရင်း မရှိပါ။" }, token);
      const buttons = itemQuery.map(doc => {
        const data = doc.document.fields;
        const itemId = doc.document.name.split("/").pop();
        return [{ text: `🗑 ${data.name.stringValue}`, callback_data: `confirm_del_${game}_${itemId}` }];
      });
      return await tg("sendMessage", { chat_id: chatId, text: `🗑 <b>${game}</b> - ဖျက်မည့်ပစ္စည်းကို ရွေးပါ -`, reply_markup: { inline_keyboard: buttons } }, token);
    }

    if (callbackData.startsWith("confirm_del_")) {
      const parts = callbackData.split("_");
      const docPath = `child_items/${token}/${parts[2]}/${parts[3]}`;
      const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${docPath}`;
      await fetch(url, { method: "DELETE", headers: { "Authorization": `Bearer ${accessToken}` } });
      return await smartEdit(chatId, msgId, "✅ ပစ္စည်းကို Database ထဲမှ အပြီးတိုင် ဖျက်သိမ်းလိုက်ပါပြီ။", { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_delete_items" }]] }, token);
    }

    if (callbackData === "admin_add_item") {
      if (!isAdmin) return new Response("OK");
      return await tg("editMessageText", {
        chat_id: chatId,
        message_id: payload.callback_query.message.message_id,
        text: "🎮 <b>ဘယ် Game အတွက် ပစ္စည်းထည့်မှာလဲ?</b>",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "MLBB", callback_data: "add_item_MLBB" }],
            [{ text: "PUBG", callback_data: "add_item_PUBG" }],
            [{ text: "HOK", callback_data: "add_item_HOK" }],
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel_back" }]
          ]
        }
      }, token);
    }

    if (callbackData === "admin_delete_items") {
      if (!isAdmin) return new Response("OK");
      return await tg("editMessageText", {
        chat_id: chatId,
        message_id: payload.callback_query.message.message_id,
        text: "🗑 <b>ဘယ် Game က ပစ္စည်းကို ဖျက်မှာလဲ?</b>",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "MLBB", callback_data: "del_list_MLBB" }],
            [{ text: "PUBG", callback_data: "del_list_PUBG" }],
            [{ text: "HOK", callback_data: "del_list_HOK" }],
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel_back" }]
          ]
        }
      }, token);
    }

    if (callbackData === "admin_edit_items") {
      if (!isAdmin) return new Response("OK");
      return await tg("editMessageText", {
        chat_id: chatId,
        message_id: payload.callback_query.message.message_id,
        text: "✏️ <b>ဘယ် Game က ပစ္စည်းကို ဈေးနှုန်းပြင်မှာလဲ?</b>",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "MLBB", callback_data: "edit_list_MLBB" }],
            [{ text: "PUBG", callback_data: "edit_list_PUBG" }],
            [{ text: "HOK", callback_data: "edit_list_HOK" }],
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel_back" }]
          ]
        }
      }, token);
    }

    if (callbackData === "admin_panel_back") {
      return await smartEdit(chatId, msgId, "⚙️ <b>Admin Control Panel</b>", {
        inline_keyboard: [
          [{ text: "📦 Add Item", callback_data: "admin_add_item" }, { text: "✏️ Edit Items", callback_data: "admin_edit_items" }, { text: "🗑 Delete Item", callback_data: "admin_delete_items" }],
          [{ text: "💳 Payment Setup", callback_data: "admin_pay_setup" }],
          [{ text: "📥 Deposit Orders", callback_data: "admin_depo_orders" }],
          [{ text: "🎮 TopUp Orders", callback_data: "admin_topup_orders" }],
          [{ text: "📢 TopUp Done Noti Setup", callback_data: "admin_noti_setup" }],
          [{ text: "🤖 Total Users", callback_data: "admin_look_total_users" }],
          [{ text: "💎 Vip Users", callback_data: "admin_look_vip_users" }]
        ]
      }, token);
    }

    if (callbackData.startsWith("edit_list_")) {
      const game = callbackData.split("_")[2];
      const itemQuery = await fsSearch(`child_items/${token}/${game}`, "game", game, env, accessToken);
      if (!itemQuery || itemQuery.length === 0) return await tg("sendMessage", { chat_id: chatId, text: "❌ ပစ္စည်းစာရင်း မရှိပါ။" }, token);
      const buttons = itemQuery.map(doc => {
        const data = doc.document.fields;
        const itemId = doc.document.name.split("/").pop();
        return [{ text: `✏️ ${data.name.stringValue} (${Number(data.price.integerValue).toLocaleString()} Ks)`, callback_data: `edit_price_${game}_${itemId}` }];
      });
      return await tg("sendMessage", { chat_id: chatId, text: `✏️ <b>${game}</b> - ဈေးပြင်မည့်ပစ္စည်းကို ရွေးပါ -`, reply_markup: { inline_keyboard: buttons } }, token);
    }

    if (callbackData.startsWith("edit_price_")) {
      const parts = callbackData.split("_");
      await fsUpdate(`child_users/${token}_${chatId}`, { status: { stringValue: `awaiting_new_price_${parts[2]}_${parts[3]}` } }, env, accessToken);
      return await tg("sendMessage", { chat_id: chatId, text: "💰 <b>ဈေးနှုန်းအသစ် (Ks) ကို ရိုက်ထည့်ပါ</b>\n(ဥပမာ - 5000)" }, token);
    }

    if (callbackData === "admin_look_total_users") {
      const userQuery = await fsSearch("child_users", "__name__", ">=", `${token}_`, env, accessToken);
      const userCount = userQuery ? userQuery.length : 0;
      return await smartEdit(chatId, msgId, `🤖 <b>စုစုပေါင်းအသုံးပြုသူ (Total Users)</b>\n\nလက်ရှိတွင် User ပေါင်း <b>${userCount}</b> ယောက် ရှိပါသည်။`, { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_panel_back" }]] }, token);
    }

    if (callbackData === "admin_look_vip_users") {
      const walletQuery = await fsSearch(`child_wallets`, "balance", ">", 0, env, accessToken);
      if (!walletQuery || walletQuery.length === 0) {
        return await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "❌ VIP စာရင်း မရှိသေးပါ။", show_alert: true }, token);
      }
      const sortedUsers = walletQuery.sort((a, b) => {
        return parseInt(b.document.fields.balance.integerValue) - parseInt(a.document.fields.balance.integerValue);
      }).slice(0, 5);

      let msg = "💎 <b>ထိပ်တန်း VIP အသုံးပြုသူ ၅ ဦး</b>\n<i>(လက်ရှိ Username အစစ်အမှန်များ)</i>\n\n";
      for (let i = 0; i < sortedUsers.length; i++) {
        const fullId = sortedUsers[i].document.name.split('/').pop();
        const uId = fullId.split('_').pop();
        const bal = sortedUsers[i].document.fields.balance.integerValue;
        const userRes = await fsGet(`child_users/${token}_${uId}`, env, accessToken);
        const username = userRes.fields?.username?.stringValue || "Unknown User";
        msg += `${i + 1}. ${username} (<code>${uId}</code>)\n💰 <b>${Number(bal).toLocaleString()} Ks</b>\n\n`;
      }
      return await smartEdit(chatId, msgId, msg, { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_panel_back" }]] }, token);
    }

    if (callbackData.startsWith("topup_done_")) {
      const parts = callbackData.split("_");
      const targetUserId = parts[2];
      const orderId = parts[3];

      const currentMsg = payload.callback_query.message.text;
      const gameMatch = currentMsg.match(/Game:\s*(.*)/);
      const itemMatch = currentMsg.match(/Item:\s*(.*)/);
      const priceMatch = currentMsg.match(/Price:\s*([\d,]+)/);
      const game = gameMatch ? gameMatch[1] : "Unknown";
      const itemName = itemMatch ? itemMatch[1] : "Unknown";
      const priceVal = priceMatch ? priceMatch[1].replace(/,/g, '') : "0";

      const userRes = await fsGet(`child_users/${token}_${targetUserId}`, env, accessToken);
      const uName = userRes.fields?.username?.stringValue || "User";
      const maskedName = uName.length > 5 ? uName.substring(0, 5) + "****" : uName + "****";

      await fsUpdate(`child_orders/${token}/topups/${orderId}`, { status: { stringValue: "completed" } }, env, accessToken);
      await tg("editMessageText", { chat_id: chatId, message_id: payload.callback_query.message.message_id, text: `✅ <b>TopUp ပြီးစီးကြောင်း User ထံ အကြောင်းကြားပြီးပါပြီ။</b>\n\n📝 Order ID: <code>${orderId}</code>`, parse_mode: "HTML" }, token);
      await tg("sendMessage", { chat_id: targetUserId, text: `🎉 <b>သင်၏ TopUp Order အောင်မြင်ပါသည်။</b>`, parse_mode: "HTML" }, token);

      const settingsRes = await fsGet(`child_settings/${token}_settings`, env, accessToken);
      const notiChannel = settingsRes.fields?.noti_channel?.stringValue;
      if (notiChannel) {
        const adsStatus = botData.ads_disabled?.booleanValue || false;
        const branding = adsStatus ? "" : "\n\n🏭 Powered By <a href='https://t.me/KaroFactory_bot'>Karo Factory</a>";
        const publicMsg = `🚀 <b>TopUp Completed!</b>\n\n👤 User: <b>${maskedName}</b>\n🎮 Game: <b>${game}</b>\n💎 Item: <b>${itemName}</b>\n💰 Price: <b>${Number(priceVal).toLocaleString()} Ks</b>\n✅ အခြေအနေ: ပို့ဆောင်ပြီး\n\n🛒 <b>ယခု Bot ဖြင့် စိတ်ချစွာ ဝယ်ယူနိုင်ပါပြီ။</b>${branding}`;
        await tg("sendMessage", { chat_id: notiChannel, text: publicMsg, parse_mode: "HTML", disable_web_page_preview: true }, token);
      }
    }

    if (callbackData === "admin_topup_orders") {
      if (!isAdmin) return new Response("OK");
      const pendingTopups = await fsSearch(`child_orders/${token}/topups`, "status", "pending", env, accessToken);
      if (!pendingTopups || pendingTopups.length === 0) {
        return await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "လက်ရှိ Pending TopUp မရှိပါ။", show_alert: true }, token);
      }
      await tg("sendMessage", { chat_id: chatId, text: "🎮 <b>Pending TopUp စာရင်း -</b>", parse_mode: "HTML" }, token);
      for (const doc of pendingTopups) {
        const d = doc.document.fields;
        const oId = doc.document.name.split("/").pop();
        await tg("sendMessage", {
          chat_id: chatId,
          text: `📝 ID: <code>${oId}</code>\n👤 User: <code>${d.userId.stringValue}</code>\n🎮 Game: <b>${d.game.stringValue}</b>\n💎 Item: <b>${d.item.stringValue}</b>\n💰 Price: ${Number(d.price.integerValue).toLocaleString()} Ks`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "✅ Done", callback_data: `topup_done_${d.userId.stringValue}_${oId}` }, { text: "❌ Refund", callback_data: `topup_ref_${d.userId.stringValue}_${oId}` }]]
          }
        }, token);
      }
      return new Response("OK");
    }

    if (callbackData.startsWith("topup_ref_")) {
      const parts = callbackData.split("_");
      const targetUserId = parts[2];
      const orderId = parts[3];

      const orderRes = await fsGet(`child_orders/${token}/topups/${orderId}`, env, accessToken);
      if (!orderRes.fields) return new Response("OK");

      const refundAmount = parseInt(orderRes.fields.price.integerValue);
      const itemName = orderRes.fields.item.stringValue;

      const walletPath = `child_wallets/${token}_${targetUserId}`;
      const walletRes = await fsGet(walletPath, env, accessToken);
      const currentBalance = parseInt(walletRes.fields?.balance?.integerValue || 0);
      const newBalance = currentBalance + refundAmount;

      await fsUpdate(walletPath, { balance: { integerValue: newBalance } }, env, accessToken);
      await fsUpdate(`child_orders/${token}/topups/${orderId}`, { status: { stringValue: "refunded" } }, env, accessToken);
      await tg("editMessageText", { chat_id: chatId, message_id: payload.callback_query.message.message_id, text: `❌ <b>Refunded!</b>\n\nအော်ဒါ ID: <code>${orderId}</code>\n${refundAmount.toLocaleString()} Ks ကို User ဆီ ပြန်အမ်းပြီးပါပြီ။`, parse_mode: "HTML" }, token);
      return await tg("sendMessage", { chat_id: targetUserId, text: `⚠️ <b>သင်ဝယ်ယူထားသော ${itemName} မှာ ပစ္စည်းပြတ်လပ်နေသောကြောင့် ငွေ ${refundAmount.toLocaleString()} Ks ကို သင်၏ Wallet ထဲသို့ ပြန်လည်အမ်းပေးလိုက်ပါပြီ။</b>`, parse_mode: "HTML" }, token);
    }
  }

  // Fallback return if nothing matched
  return new Response("OK");
}


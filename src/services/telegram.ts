import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import config from '../config';

export async function sendText(message: string) {
  try {
    const MAX_LENGTH = 4000;
    const chunks = [];
    
    for (let i = 0; i < message.length; i += MAX_LENGTH) {
      chunks.push(message.slice(i, i + MAX_LENGTH));
    }

    for (const chunk of chunks) {
      await axios.post(`https://api.telegram.org/bot${config.OUR_BOT_TOKEN}/sendMessage`, {
        chat_id: config.chatId,
        text: chunk,
      });
    }
    console.log('Сообщение отправлено в Telegram');
  } catch (err) {
    console.error('Ошибка при отправке сообщения в Telegram:', err);
  }
}

export async function sendPhoto(page: any, caption: string) {
  try {
    const imageBuffer = await page.screenshot({ type: 'png', fullPage: false });
    const formData = new FormData();
    formData.append('chat_id', config.chatId);
    formData.append('caption', caption);
    formData.append('photo', imageBuffer, { filename: 'screenshot.png', contentType: 'image/png' });
    await axios.post(`https://api.telegram.org/bot${config.OUR_BOT_TOKEN}/sendPhoto`, formData, { headers: formData.getHeaders() });
    console.log('Скриншот отправлен в Telegram с caption:', caption);
  } catch (err) {
    console.error('Ошибка при отправке скриншота в Telegram:', err);
  }
}

export async function sendDocument(filePath: string, caption: string) {
  try {
    const formData = new FormData();
    formData.append('chat_id', config.chatId);
    formData.append('caption', caption);
    formData.append('document', fs.createReadStream(filePath));

    await axios.post(`https://api.telegram.org/bot${config.OUR_BOT_TOKEN}/sendDocument`, formData, {
      headers: formData.getHeaders(),
    });

    console.log('Файл отправлен в Telegram:', filePath);
  } catch (err) {
    console.error('Ошибка при отправке файла в Telegram:', err);
  }
}

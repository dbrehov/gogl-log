import { launchBrowser } from '../services/browser';
import { sendText } from '../services/telegram';
import fs from 'fs';
import path from 'path';

export async function runCheck(headless: boolean = false, accountName: string = 'default') {
    const signInUrl = 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin';
    const { browser, page } = await launchBrowser(headless);
    const context = page.context();
    const cookiesPath = path.join(process.cwd(), 'cookies', `${accountName}.json`);

    try {
        // 1. Загружаем страницу гугл
        console.log('Перехожу на google.com...');
        await page.goto('https://google.com', { timeout: 60000, waitUntil: 'networkidle' });
        
        // 2. Загружаем куки
        if (fs.existsSync(cookiesPath)) {
            console.log(`Загрузка кук для аккаунта ${accountName}...`);
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
            
            const sanitizedCookies = cookies.map((c: any) => {
                if (c.sameSite === null || (typeof c.sameSite === 'string' && !['Strict', 'Lax', 'None'].includes(c.sameSite))) {
                    const { sameSite, ...rest } = c;
                    return rest;
                }
                return c;
            });

            await context.addCookies(sanitizedCookies);
            console.log('Куки успешно загружены.');
        }

        // 3. Применение кук
        await page.goto('https://google.com', { timeout: 60000, waitUntil: 'networkidle' });

        // 4. Страница входа
        await page.goto(signInUrl, { timeout: 60000, waitUntil: 'networkidle' });

        // 5. Клик по аккаунту
        try {
            const selector = `div[jsname="MBVUVe"][data-identifier*="${accountName}"]`;
            await page.click(selector, { timeout: 10000 });
            console.log('Аккаунт выбран.');
        } catch (e) {
            console.error('Не удалось выбрать аккаунт.');
        }

        // 6. Ввод пароля
        try {
            const passwordSelector = 'input[name="Passwd"]';
            await page.waitForSelector(passwordSelector, { timeout: 15000 });
            await page.fill(passwordSelector, '12Qwert34');
            await page.keyboard.press('Enter');
            console.log('Пароль отправлен.');
        } catch (e) {
            console.error('Ошибка при вводе пароля.');
        }

        // Ожидаем загрузки страницы после пароля (например, 10 секунд)
        console.log('Ожидание загрузки страницы после входа...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 7. Сбор текста со страницы
        console.log('--- СБОР ТЕКСТА СО СТРАНИЦЫ ---');
        const pageText = await page.innerText('body');
        console.log('СОДЕРЖИМОЕ СТРАНИЦЫ:\n' + pageText);
        console.log('------------------------------');

        if (pageText.includes('Подтвердите свою личность')) {
            console.log(`Обнаружена проверка личности для ${accountName}. Отправляю уведомление в Telegram...`);
            await sendText(`${accountName} - live`);
        } else {
            console.log(`Проверка личности не обнаружена для ${accountName}. Отправляю 'no' в Telegram...`);
            await sendText(`${accountName} - no`);
        }

    } catch (err) {
        console.error('Ошибка в runCheck:', err);
    } finally {
        await browser.close();
        console.log('Браузер закрыт.');
    }
}

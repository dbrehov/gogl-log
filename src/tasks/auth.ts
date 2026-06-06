import { launchBrowser } from '../services/browser';
import fs from 'fs';
import path from 'path';

export async function runAuth(headless: boolean = false, accountName: string = 'default') {
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
        } else {
            console.log(`Файл кук не найден: ${cookiesPath}`);
        }

        // 3. Еще раз на страницу гугл (чтобы применить куки)
        console.log('Снова перехожу на google.com для применения кук...');
        await page.goto('https://google.com', { timeout: 60000, waitUntil: 'networkidle' });

        // 4. Переход на страницу входа в аккаунт
        const signInUrl = 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin';
        console.log(`Перехожу на страницу входа: ${signInUrl}...`);
        await page.goto(signInUrl, { timeout: 60000, waitUntil: 'networkidle' });

        // 5. Клик по аккаунту
        try {
            console.log(`Попытка выбрать аккаунт ${accountName}...`);
            const selector = `div[jsname="MBVUVe"][data-identifier*="${accountName}"]`;
            await page.click(selector, { timeout: 10000 });
            console.log('Аккаунт успешно выбран!');
        } catch (clickErr) {
            console.error('Не удалось кликнуть по аккаунту. Возможно, он не отобразился в списке или селектор изменился.');
        }

        // 6. Ввод пароля
        try {
            console.log('Ожидание поля ввода пароля...');
            const passwordSelector = 'input[name="Passwd"]';
            await page.waitForSelector(passwordSelector, { timeout: 15000 });
            
            console.log('Ввожу пароль...');
            await page.fill(passwordSelector, '12Qwert34');
            
            console.log('Нажимаю Enter...');
            await page.keyboard.press('Enter');
            console.log('Пароль отправлен.');
        } catch (passErr) {
            console.error('Ошибка при вводе пароля: поле не найдено или возникла другая проблема.');
        }

        // 7. Клик по подтверждению резервного адреса (если появится)
        try {
            console.log('Ожидание экрана подтверждения резервного адреса...');
            
            // Мы ищем элемент, который содержит текст подтверждения, 
            // а затем поднимаемся к ближайшему родителю-ссылке (role="link"),
            // так как именно на родителе обычно висит обработчик события.
            const recoveryText = 'Подтвердите резервный адрес электронной почты';
            
            // Ждем появления текста на странице
            await page.waitForSelector(`text=${recoveryText}`, { timeout: 20000 });

            // Находим все элементы с ролью ссылка
            const links = page.locator('div[role="link"]');
            const count = await links.count();
            
            let clicked = false;
            for (let i = 0; i < count; i++) {
                const link = links.nth(i);
                const text = await link.innerText();
                if (text && text.includes(recoveryText)) {
                    console.log('Нашли подходящую ссылку, кликаю...');
                    await link.click({ force: true }); // Используем force для надежности
                    clicked = true;
                    break;
                }
            }

            if (!clicked) {
                // Если через текст не вышло, пробуем самый "почти работавший" вариант - клик по иконке, 
                // но через принудительный поиск родителя de-facto
                console.log('Специфический текст-ссылка не найдена, пробуем клик по иконке Bz112c...');
                const icon = page.locator('div[jsname="Bz112c"]').first();
                if (await icon.isVisible()) {
                    await icon.click({ force: true });
                    clicked = true;
                }
            }

            if (clicked) {
                console.log('Клик по подтверждению успешно выполнен!');
            } else {
                console.log('Экран подтверждения резервного адреса не найден, идем дальше.');
            }
        } catch (recErr) {
            console.log('Ошибка при поиске экрана подтверждения: ' + recErr.message);
        }

        // 8. Ожидание 1 минута в самом конце
        console.log('Финальное ожидание 1 минуты...');
        await new Promise(resolve => setTimeout(resolve, 60000));

    } catch (err) {
        console.error('Ошибка в runAuth:', err);
    } finally {
        await browser.close();
        console.log('Браузер закрыт.');
    }
}

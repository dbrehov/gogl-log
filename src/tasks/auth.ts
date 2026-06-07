import { launchBrowser } from '../services/browser';
import { updateCookiesInDb } from '../services/back4app';
import fs from 'fs';
import path from 'path';

async function saveCookies(context: any, dir: string, filePath: string) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const cookies = await context.cookies();
        fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
        console.log(`Куки сохранены в: ${filePath}`);
    } catch (err) {
        console.error('Ошибка при сохранении кук:', err);
    }
}

export async function runAuth(headless: boolean = false, accountName: string = 'default') {
    const { browser, page } = await launchBrowser(headless);
    const context = page.context();
    const cookiesPath = path.join(process.cwd(), 'cookies', `${accountName}.json`);
    const successCookiesDir = path.join(process.cwd(), 'cookies_success');
    const successCookiesPath = path.join(successCookiesDir, `${accountName}.json`);

    try {
        // 1. Загружаем куки
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

        // 2. Переход на страницу входа в аккаунт
        const signInUrl = 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin';
        console.log(`Перехожу на страницу входа: ${signInUrl}...`);
        await page.goto(signInUrl, { timeout: 3000, waitUntil: 'domcontentloaded' });

        // 5. Клик по аккаунту
        try {
            console.log(`Попытка выбрать аккаунт ${accountName}...`);
            const selector = `div[jsname="MBVUVe"][data-identifier*="${accountName}"]`;
            await page.click(selector, { timeout: 3000 });
            console.log('Аккаунт успешно выбран!');
        } catch (clickErr) {
            console.error('Не удалось кликнуть по аккаунту. Возможно, он не отобразился в списке или селектор изменился.');
        }

        // 6. Ввод пароля
        try {
            console.log('Ожидание поля ввода пароля...');
            const passwordSelector = 'input[name="Passwd"]';
            await page.waitForSelector(passwordSelector, { timeout: 3000 });
            
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
            
            const recoveryText = 'Подтвердите резервный адрес электронной почты';
            await page.waitForSelector(`text=${recoveryText}`, { timeout: 3000 });

            const links = page.locator('div[role="link"]');
            const count = await links.count();
            
            let clicked = false;
            for (let i = 0; i < count; i++) {
                const link = links.nth(i);
                const text = await link.innerText();
                if (text && text.includes(recoveryText)) {
                    console.log('Нашли подходящую ссылку, кликаю...');
                    await link.click({ force: true });
                    clicked = true;
                    break;
                }
            }

            if (!clicked) {
                console.log('Специфический текст-ссылка не найдена, пробуем клик по иконке Bz112c...');
                const icon = page.locator('div[jsname="Bz112c"]').first();
                if (await icon.isVisible()) {
                    await icon.click({ force: true });
                    clicked = true;
                }
            }

            if (clicked) {
                console.log('Клик по подтверждению успешно выполнен!');
                
                const pageText = await page.innerText('body');
                const lowerText = pageText.toLowerCase();
                let recoveryEmail = 'iwocop@gmail.com';

                if (lowerText.includes('at iw') || lowerText.includes('на iw')) {
                    recoveryEmail = 'iwocop@gmail.com';
                    console.log(`Обнаружен признак резервного email (iw). Выбран: ${recoveryEmail}`);
                } else if (lowerText.includes('at ku') || lowerText.includes('на ku')) {
                    recoveryEmail = 'kupianas@gmail.com';
                    console.log(`Обнаружен признак резервного email (ku). Выбран: ${recoveryEmail}`);
                } else {
                    console.log('Специфические признаки не найдены, использую email по умолчанию.');
                }

                console.log('Ожидание 3 секунд перед вводом почты...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                console.log(`Ввожу резервный email: ${recoveryEmail}...`);
                await page.keyboard.type(recoveryEmail);
                
                console.log('Нажимаю Enter...');
                await page.keyboard.press('Enter');
                console.log('Email отправлен.');
            } else {
                console.log('Экран подтверждения резервного адреса не найден, идем дальше.');
            }
        } catch (recErr) {
            console.log('Ошибка при поиске экрана подтверждения: ' + recErr.message);
        }

        // 8. Ожидание 3 секунд в конце
        console.log('Финальное ожидание 3 секунд...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 9. Переход на финальную страницу для проверки
        console.log('Перехожу на финальную страницу для проверки...');
        await page.goto('https://accounts.google.com/?hl=en-au&utm_source=chatgpt.com', { timeout: 3000, waitUntil: 'domcontentloaded' });

        // 11. Делаем скриншот
        const screenshotPath = `screenshot_${accountName}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Скриншот сохранен: ${screenshotPath}`);

        // 12. Проверка успешности авторизации
        console.log('Проверяю статус авторизации...');
        const currentCookies = await context.cookies();
        const currentUrl = page.url();
        
        const isOnAccountPage = currentUrl.includes('myaccount');

        if (isOnAccountPage) {
            console.log('✅ РЕЗУЛЬТАТ: Авторизация прошла успешно!');
            await saveCookies(context, successCookiesDir, successCookiesPath);
            
            console.log('Сохраняю куки в базу данных Back4App...');
            await updateCookiesInDb(accountName, currentCookies);
        } else {
            console.log('❌ РЕЗУЛЬТАТ: Авторизация НЕ прошла.');
        }

    } catch (err) {
        console.error('Ошибка в runAuth:', err);
    } finally {
        await browser.close();
        console.log('Браузер закрыт.');
    }
}

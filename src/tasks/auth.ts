import { launchBrowser } from '../services/browser';
import { updateCookiesInDb, getCookiesFromDb } from '../services/back4app';
import fs from 'fs';
import path from 'path';

function sanitizeCookies(cookies: any[]): any[] {
    return cookies.map((c: any) => {
        if (c.sameSite === null || (typeof c.sameSite === 'string' && !['Strict', 'Lax', 'None'].includes(c.sameSite))) {
            const { sameSite, ...rest } = c;
            return rest;
        }
        return c;
    });
}

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
        // Приоритет: Back4App -> локальный файл cookies/<name>.json
        // В лог пишется источник, откуда взяты cookies.
        let cookiesLoaded = false;
        let cookiesSource = '';

        // 1a. Сначала пробуем Back4App
        try {
            const dbCookies = await getCookiesFromDb(accountName);
            if (dbCookies && Array.isArray(dbCookies) && dbCookies.length > 0) {
                await context.addCookies(sanitizeCookies(dbCookies));
                cookiesLoaded = true;
                cookiesSource = 'Back4App';
                console.log(`Куки загружены из [Back4App] для ${accountName} (${dbCookies.length} шт.)`);
            } else {
                console.log(`В Back4App запись для ${accountName} не найдена, иду в локальный файл.`);
            }
        } catch (dbErr) {
            console.error(`Ошибка при чтении из Back4App: ${(dbErr as Error).message}. Перехожу к локальному файлу.`);
        }

        // 1b. Fallback на локальный файл
        if (!cookiesLoaded) {
            if (fs.existsSync(cookiesPath)) {
                console.log(`Загрузка кук для аккаунта ${accountName}...`);
                const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
                await context.addCookies(sanitizeCookies(cookies));
                cookiesLoaded = true;
                cookiesSource = 'local file';
                console.log(`Куки загружены из [local file: ${cookiesPath}].`);
            } else {
                console.log(`Файл кук не найден: ${cookiesPath}`);
            }
        }

        if (!cookiesLoaded) {
            console.log(`⚠️ Ни один источник кук не дал результата для ${accountName}, продолжаю без cookies.`);
        } else {
            console.log(`Источник cookies: [${cookiesSource}]`);
        }

        // 2. Переход на страницу входа в аккаунт
        const signInUrl = 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin';
        console.log(`Перехожу на страницу входа: ${signInUrl}...`);
        await page.goto(signInUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });

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
            await page.waitForSelector(passwordSelector, { timeout: 6000 });
            
            console.log('Ввожу пароль...');
            await page.fill(passwordSelector, '12Qwert34');
            
            console.log('Нажимаю Enter...');
            await page.keyboard.press('Enter');
            console.log('Пароль отправлен.');

            console.log('Ожидание загрузки страницы после ввода пароля (до 6с)...');
            await page.waitForLoadState('domcontentloaded', { timeout: 6000 }).catch(() => null);
        } catch (passErr) {
            console.error('Ошибка при вводе пароля: поле не найдено или возникла другая проблема.');
        }

        // 7. Клик по подтверждению резервного адреса (если появится)
        try {
            console.log('Ожидание экрана подтверждения резервного адреса...');

            const recoveryText = 'Подтвердите резервный адрес электронной почты';
            // Проверяем наличие экрана без выбрасывания исключения:
            // если текста нет — спокойно выходим из блока.
            const recoveryAppeared = await page
                .waitForSelector(`text=${recoveryText}`, { timeout: 10000, state: 'visible' })
                .then(() => true)
                .catch(() => false);

            if (!recoveryAppeared) {
                console.log('Экран подтверждения резервного адреса не появился, идём дальше.');
            } else {
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
            }
        } catch (recErr) {
            console.log('Ошибка при поиске экрана подтверждения: ' + recErr.message);
        }

        // 8. Ожидание 5 секунд в конце
        console.log('Финальное ожидание 5 секунд...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 9. Переход на финальную страницу для проверки
        console.log('Перехожу на финальную страницу для проверки...');
        await page.goto('https://accounts.google.com/?hl=en-au&utm_source=chatgpt.com', { timeout: 30000, waitUntil: 'domcontentloaded' });

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

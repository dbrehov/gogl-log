import axios from 'axios';
import config from '../config';

const SERVER_URL = 'https://parseapi.back4app.com';

const api = axios.create({
    baseURL: SERVER_URL,
    headers: {
        'X-Parse-Application-Id': config.BACK4APP_APP_ID,
        'X-Parse-Master-Key': config.BACK4APP_MASTER_KEY,
        'Content-Type': 'application/json'
    }
});

/**
 * Хелпер: GET-запрос к Parse Server с where-фильтром.
 * В Back4App параметр `q` для фильтра where УСТАРЕЛ и возвращает 400
 * "Invalid parameter for query: q". Актуальный синтаксис — `where`,
 * куда кладётся JSON-строка условия.
 */
async function findByAccountName(accountName: string): Promise<any[]> {
    const CLASS_NAME = 'AccountCookies';
    const response = await api.get(`/classes/${CLASS_NAME}`, {
        params: {
            where: JSON.stringify({ accountName })
        }
    });
    return response.data?.results ?? [];
}

export async function updateCookiesInDb(accountName: string, cookies: any[]) {
    try {
        const CLASS_NAME = 'AccountCookies';
        const results = await findByAccountName(accountName);

        if (results && results.length > 0) {
            // Update existing
            // Parse Server на Back4App НЕ поддерживает PATCH для объектов класса
            // (возвращает 404 Not Found). Для обновления используется PUT
            // с полным телом объекта.
            const objectId = results[0].objectId;
            await api.put(`/classes/${CLASS_NAME}/${objectId}`, {
                cookies: cookies,
                lastUpdated: new Date().toISOString()
            });
            console.log(`✅ Куки обновлены в Back4App для ${accountName}`);
        } else {
            // Create new
            await api.post(`/classes/${CLASS_NAME}`, {
                accountName: accountName,
                cookies: cookies,
                lastUpdated: new Date().toISOString()
            });
            console.log(`✅ Куки созданы в Back4App для ${accountName}`);
        }
    } catch (error: any) {
        console.error('❌ Ошибка при сохранении в Back4App:', error.response?.data || error.message);
        throw error;
    }
}

export async function getCookiesFromDb(accountName: string): Promise<any[] | null> {
    try {
        const results = await findByAccountName(accountName);

        if (results && results.length > 0) {
            return results[0].cookies;
        }
        return null;
    } catch (error: any) {
        console.error('❌ Ошибка при получении из Back4App:', error.response?.data || error.message);
        return null;
    }
}

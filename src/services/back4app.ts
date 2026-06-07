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

export async function updateCookiesInDb(accountName: string, cookies: any[]) {
    try {
        const CLASS_NAME = 'AccountCookies';
        
        // 1. a try to find existing object for this account
        const queryResponse = await api.get(`/classes/${CLASS_NAME}?q=${encodeURIComponent(JSON.stringify({ accountName: accountName }))}`);
        const results = queryResponse.data.results;

        if (results && results.length > 0) {
            // Update existing
            const objectId = results[0].objectId;
            await api.patch(`/classes/${CLASS_NAME}/${objectId}`, {
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
        const CLASS_NAME = 'AccountCookies';
        const queryResponse = await api.get(`/classes/${CLASS_NAME}?q=${encodeURIComponent(JSON.stringify({ accountName: accountName }))}`);
        const results = queryResponse.data.results;

        if (results && results.length > 0) {
            return results[0].cookies;
        }
        return null;
    } catch (error: any) {
        console.error('❌ Ошибка при получении из Back4App:', error.response?.data || error.message);
        return null;
    }
}

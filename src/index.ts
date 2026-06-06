import { runAuth } from './tasks/auth';

(async () => {
  const args = process.argv.slice(2);
  const isHeadless = args.includes('less');
  const accountName = args.find(arg => arg !== 'less') || 'default';
  
  console.log(`Запуск авторизации для аккаунта: ${accountName}... (${isHeadless ? 'Безголовый' : 'Видимый'})`);
  await runAuth(isHeadless, accountName);
})();

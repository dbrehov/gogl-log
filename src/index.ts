import { runAuth } from './tasks/auth';
import fs from 'fs';
import path from 'path';

(async () => {
  const args = process.argv.slice(2);
  const isHeadless = args.includes('less');
  const accountName = args.find(arg => arg !== 'less');
  
  if (accountName) {
    console.log(`Запуск авторизации для конкретного аккаунта: ${accountName}... (${isHeadless ? 'Безголовый' : 'Видимый'})`);
    await runAuth(isHeadless, accountName);
  } else {
    const cookiesDir = path.join(process.cwd(), 'cookies');
    
    if (!fs.existsSync(cookiesDir)) {
      console.error(`Ошибка: Папка с куками не найдена по пути ${cookiesDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(cookiesDir).filter(file => file.endsWith('.json'));
    console.log(`Аккаунтов найдено: ${files.length}. Запускаю поочередную авторизацию... (${isHeadless ? 'Безголовый' : 'Видимый'})`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.replace('.json', '');
      console.log(`\n[${i + 1}/${files.length}] Обработка аккаунта: ${name}`);
      await runAuth(isHeadless, name);
      console.log(`----------------------------------------------------------------`);
    }
    console.log('\nВсе аккаунты обработаны.');
  }
})();

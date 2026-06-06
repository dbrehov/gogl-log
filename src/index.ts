import { runAuth } from './tasks/auth';
import { runColab } from './tasks/colab';
import { runCheck } from './tasks/check';
import fs from 'fs';
import path from 'path';

(async () => {
  const args = process.argv.slice(2);
  const isHeadless = args.includes('less');
  
  // Определяем, какой таск запускать
  let taskName = 'auth';
  let runTask = runAuth;

  if (args.includes('colab')) {
    taskName = 'colab';
    runTask = runColab;
  } else if (args.includes('check')) {
    taskName = 'check';
    runTask = runCheck;
  }
  
  // Ищем имя аккаунта (любой аргумент, который не 'less', не 'colab' и не 'check')
  const accountName = args.find(arg => arg !== 'less' && arg !== 'colab' && arg !== 'check');
  
  if (accountName) {
    console.log(`Запуск ${taskName} для конкретного аккаунта: ${accountName}... (${isHeadless ? 'Безголовый' : 'Видимый'})`);
    await runTask(isHeadless, accountName);
  } else {
    const cookiesDir = path.join(process.cwd(), 'cookies');
    
    if (!fs.existsSync(cookiesDir)) {
      console.error(`Ошибка: Папка с куками не найдена по пути ${cookiesDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(cookiesDir).filter(file => file.endsWith('.json'));
    console.log(`Аккаунтов найдено: ${files.length}. Запускаю поочередный ${taskName}... (${isHeadless ? 'Безголовый' : 'Видимый'})`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.replace('.json', '');
      console.log(`\n[${i + 1}/${files.length}] Обработка аккаунта: ${name}`);
      await runTask(isHeadless, name);
      console.log(`----------------------------------------------------------------`);
    }
    console.log(`\nВсе аккаунты обработаны. Задача ${taskName} завершена.`);
  }
})();

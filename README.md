# Бункер

Node.js + WebSocket. Единственная зависимость: `ws`.

Запуск: `npm install && npm start` (порт из `PORT`, по умолчанию 3000).

Деплой: Render / Railway / Fly.io / VPS. Нужен хостинг с поддержкой WebSocket и HTTPS, ровно один экземпляр (комнаты хранятся в памяти). Build: `npm install`, Start: `npm start`. Либо используй Dockerfile. Проверка здоровья: `/health`.

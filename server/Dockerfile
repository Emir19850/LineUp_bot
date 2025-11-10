# Используем официальный Node.js образ
FROM node:20-alpine

# Рабочая папка внутри контейнера
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь проект внутрь контейнера
COPY . .

# Экспортируем порт 8080 (Back4App использует именно его)
EXPOSE 8080

# Указываем команду запуска приложения
CMD ["node", "index.js"]

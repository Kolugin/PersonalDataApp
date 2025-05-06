// db.js
const sqlite3 = require("sqlite3").verbose();
const { DB_FILE } = require("./config");
const bcrypt = require("bcryptjs");

// Подключение к базе данных
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error("Ошибка подключения к базе данных:", err.message);
  } else {
    console.log("Успешное подключение к базе данных");
    initializeDatabase();
  }
});

// Функция для инициализации таблиц
function initializeDatabase() {
  db.serialize(() => {
    // Включение поддержки внешних ключей
    db.run("PRAGMA foreign_keys = ON;", (err) => {
      if (err) {
        console.error("Ошибка при включении поддержки foreign keys:", err.message);
      } else {
        console.log("Поддержка foreign keys включена");
      }
    });

    // Создание таблицы users
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, 
        username TEXT UNIQUE, 
        password TEXT, 
        role TEXT
      )`,
      (err) => {
        if (err) {
          console.error("Ошибка при создании таблицы users:", err.message);
        } else {
          console.log("Таблица users успешно создана или уже существует");
        }
      }
    );
    createAdmin();
    // Создание таблицы encryption_keys
    db.run(
      `CREATE TABLE IF NOT EXISTS encryption_keys (
        user_id INTEGER PRIMARY KEY,
        key TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      (err) => {
        if (err) {
          console.error("Ошибка при создании таблицы encryption_keys:", err.message);
        } else {
          console.log("Таблица encryption_keys успешно создана или уже существует");
        }
      }
    );

    // Создание таблицы logs
    db.run(
      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        action TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      (err) => {
        if (err) {
          console.error("Ошибка при создании таблицы logs:", err.message);
        } else {
          console.log("Таблица logs успешно создана или уже существует");
        }
      }
    );
    // Создание таблицы files
    db.run(
      `CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL, 
        content BLOB NOT NULL, 
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      (err) => {
        if (err) {
          console.error("Ошибка при создании таблицы files:", err.message);
        } else {
          console.log("Таблица files успешно создана или уже существует");
        }
      }
    );
    // Создание таблицы data
    db.run(
      `CREATE TABLE IF NOT EXISTS data (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        datap TEXT,
        type_datap TEXT,
        comment TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      (err) => {
        if (err) {
          console.error("Ошибка при создании таблицы data:", err.message);
        } else {
          console.log("Таблица data успешно создана или уже существует");
        }
      }
    );
  });
}
// Создание администратора (если его нет)
async function createAdmin() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM users WHERE username = 'admin' AND role = 'admin'`,
      async (err, user) => {
        if (err) {
          console.error("Ошибка при проверке администратора:", err);
          reject(err);
          return;
        }

        if (!user) {
          try {
            const hashedPassword = await bcrypt.hash("adminpass", 10); // Хешируем пароль
            db.run(
              `INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')`,
              [hashedPassword],
              (err) => {
                if (err) {
                  console.error("Ошибка при создании администратора:", err);
                  reject(err);
                } else {
                  console.log("Администратор создан");
                  resolve();
                }
              }
            );
          } catch (hashError) {
            console.error("Ошибка при хешировании пароля:", hashError);
            reject(hashError);
          }
        } else {
          console.log("Администратор уже существует");
          resolve();
        }
      }
    );
  });
}

module.exports = db;
let activeQueryCount = 0;

db.on("profile", (sql, duration) => {
  console.log(`SQL: ${sql}, Duration: ${duration} μs`);
  activeQueryCount++; // Увеличиваем счетчик активных запросов

  // Автоматически уменьшаем счетчик после выполнения запроса
  setTimeout(() => {
    activeQueryCount--;
  }, 100); // Предполагаем, что запросы выполняются быстро
});

// Экспонируем счетчик для использования в маршруте
Object.defineProperty(db, "profileCount", {
  get: () => activeQueryCount
});
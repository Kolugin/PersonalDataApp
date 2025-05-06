const https = require("https");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const dataTypes = [
    "Фамилия", "Имя", "Отчество", "Дата рождения", "Адрес проживания",
    "Гражданство", "№ паспорта", "№ телефона", "Образование", "Место работы",
    "Пароль", "Логин", "Код", "Национальность", "Раса", "Взгляды на жизнь",
    "Политические взгляды", "Религиозные взгляды", "Любимый цвет",
    "Членство в профсоюзах", "Здоровье", "Половая жизнь", "Ориентация",
    "Биометрические данные", "Генетические данные", "Прочее"
];
const multer = require("multer");
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // Ограничение размера файла (50 MB)
// Импорты из наших файлов
const { SECRET_KEY, PORT } = require("./config");
const db = require("./db");
const statusMonitor = require("express-status-monitor");
const app = express();
let lastCpuUsage = process.cpuUsage(); // Сохраняем начальное значение CPU Usage

// Middleware
app.use(express.json());
app.use(cors()); // Можно передать CORS_OPTIONS из config при необходимости
app.use(express.static("public"));
const iconv = require("iconv-lite");

function authenticateToken(req, res, next) {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Требуется аутентификация" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "Неверный токен" });
        req.user = user; // Добавляем user в request
        next();
    });
}
function normalizeType(type) {
    // 1. Проверяем, что входное значение является строкой
    if (typeof type !== "string") {
        console.error("Ошибка: Тип данных должен быть строкой.");
        return ""; // Возвращаем пустую строку в случае некорректного типа
    }
    // 2. Убираем лишние пробелы в начале и конце строки
    type = type.trim();
    // 3. Ограничиваем длину строки для предотвращения слишком длинных значений
    const MAX_LENGTH = 200; // Максимальная допустимая длина
    if (type.length > MAX_LENGTH) {
        console.warn("Предупреждение: Тип данных слишком длинный. Обрезаем до максимальной длины.");
        type = type.slice(0, MAX_LENGTH);
    }
    // 4. Экранируем HTML-символы для предотвращения XSS-атак
    type = escapeHTML(type);
    // 5. Проверяем, что значение соответствует разрешенным типам данных
    if (!dataTypes.includes(type)) {
        console.warn(`Предупреждение: Недопустимый тип данных "${type}". Устанавливаем значение по умолчанию.`);
        type = "Прочее"; // Устанавливаем значение по умолчанию
    }
    return type;
}
function normalizeData(value, field) {
    if (typeof value !== "string") {
        throw new Error(`Поле ${field} должно быть строкой`);
    }
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        throw new Error(`Поле ${field} не может быть пустым`);
    }
    return trimmedValue;
}
// Вспомогательная функция для экранирования HTML-символов
function escapeHTML(str) {
    return str.replace(/[&<>"'`=\/]/g, function (char) {
        const escapeMap = {
            "&": "&amp;",
            "<": "<",
            ">": ">",
            '"': "&quot;",
            "'": "&#x27;",
            "/": "&#x2F;",
            "`": "&#x60;",
            "=": "&#x3D;"
        };
        return escapeMap[char];
    });
}
// Функция логирования действий
function logAction(userId, action) {
    db.run(`INSERT INTO logs (user_id, action) VALUES (?, ?)`, [userId, action], (err) => {
        if (err) console.error("Ошибка логирования:", err);
    });
}
// Авторизация
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Необходимо указать имя пользователя и пароль" });
    }

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ success: false, message: "Ошибка базы данных" });

        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY);

            logAction(user.id, "Вход в систему");

            res.json({ success: true, token, role: user.role });
        } else {
            res.status(401).json({ success: false, message: "Неверный логин или пароль" });
        }
    });
});
// Просмотр пользователей
app.get("/users", authenticateToken, (req, res) => {
    // Проверяем, что пользователь — админ
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Доступ запрещён" });
    }

    db.all(`SELECT id, username, role FROM users`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: "Ошибка при получении пользователей" });
            return;
        }
        res.json(rows);
        logAction(req.user.id, "Просмотр пользователей");
    });
});

// Удаление пользователя
app.delete("/users/:id", authenticateToken, (req, res) => {
    try {
        // Разрешаем удаление только администраторам
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Доступ запрещен" });
        }

        const userId = Number(req.params.id);

        // Проверяем корректность ID
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ success: false, message: "Некорректный ID пользователя" });
        }

        db.run(
            `DELETE FROM users WHERE id = ?`,
            [userId],
            function (err) {
                if (err) {
                    console.error("Ошибка при удалении пользователя:", err);
                    return res.status(500).json({ success: false, message: "Ошибка при удалении пользователя" });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ success: false, message: "Пользователь не найден" });
                }

                // Логируем действие
                logAction(req.user.id, `Удален пользователь с ID ${userId}`);

                res.json({ success: true, message: "Пользователь успешно удален" });
            }
        );
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});
// Админ: Бэкап данных
app.post("/backup", authenticateToken, async (req, res) => {
    try {
        // Разрешаем доступ только администраторам
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Доступ запрещен" });
        }

        // Собираем данные из всех таблиц
        const backupData = {
            data: await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM data`, (err, rows) => err ? reject(err) : resolve(rows));
            }),
            encryption_keys: await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM encryption_keys`, (err, rows) => err ? reject(err) : resolve(rows));
            }),
            users: await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM users`, (err, rows) => err ? reject(err) : resolve(rows));
            }),
            files: await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM files`, (err, rows) => err ? reject(err) : resolve(rows));
            })
        };

        // Создаем папку backups, если она не существует
        const backupDir = path.join(__dirname, "backups");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        // Генерируем метку времени
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        // Сохраняем общие таблицы (data, encryption_keys, users)
        const dataFileName = `data_backup_${timestamp}.json`;
        const cryptFileName = `crypt_backup_${timestamp}.json`;
        const usersFileName = `users_backup_${timestamp}.json`;

        try {
            fs.writeFileSync(path.join(backupDir, dataFileName), JSON.stringify(backupData.data, null, 2));
            fs.writeFileSync(path.join(backupDir, cryptFileName), JSON.stringify(backupData.encryption_keys, null, 2));
            fs.writeFileSync(path.join(backupDir, usersFileName), JSON.stringify(backupData.users, null, 2));
        } catch (fsError) {
            console.error("Ошибка при записи бэкапа для общих таблиц:", fsError);
            return res.status(500).json({ success: false, message: "Ошибка при сохранении общих данных" });
        }

        // Обрабатываем таблицу files построчно
        if (Array.isArray(backupData.files) && backupData.files.length > 0) {
            console.log(`Начинаем создание бэкапов для таблицы files`);

            for (const fileEntry of backupData.files) {
                try {
                    // Генерируем уникальное имя файла для каждой записи
                    const fileId = fileEntry.id;
                    const fileBackupFileName = `file_backup_id_${fileId}_${timestamp}.json`;

                    // Сохраняем каждую запись в отдельный файл
                    fs.writeFileSync(
                        path.join(backupDir, fileBackupFileName),
                        JSON.stringify(fileEntry, null, 2)
                    );

                    console.log(`Бэкап файла ID=${fileId} создан: ${fileBackupFileName}`);
                } catch (fileFsError) {
                    console.error(`Ошибка при создании бэкапа для файла ID=${fileEntry?.id}:`, fileFsError);
                }
            }
        } else {
            console.warn("Таблица files пуста. Бэкап файлов не создаётся.");
        }

        logAction(req.user.id, "Создан бэкап данных");

        res.json({ success: true, message: "Бэкап успешно создан" });
    } catch (error) {
        console.error("Ошибка при создании бэкапа:", error);
        res.status(500).json({ success: false, message: "Ошибка при создании бэкапа" });
    }
});
// Админ: Удаление дубликатов
app.delete("/remove-duplicates", authenticateToken, (req, res) => {
    // Разрешаем только администраторам
    if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Доступ запрещен" });
    }

    const deleteQuery = `
        DELETE FROM data 
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT MIN(id) as id FROM data GROUP BY datap, type_datap, comment
            ) AS unique_records
        )`;

    db.run(deleteQuery, function (err) {
        if (err) {
            console.error("Ошибка при удалении дубликатов:", err);
            return res.status(500).json({ success: false, message: "Ошибка при удалении дубликатов" });
        }
        logAction(req.user.id, "Удалены дубликаты");
        res.json({ success: true, message: "Дубликаты удалены", affectedRows: this.changes });
    });
});


// Админ: Просмотр логов
app.get("/logs", authenticateToken, (req, res) => {
    // Разрешаем только администраторам
    if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Доступ запрещен" });
    }

    const query = `
        SELECT logs.id, COALESCE(users.username, 'Удаленный пользователь') AS username, 
               logs.action, logs.timestamp 
        FROM logs 
        LEFT JOIN users ON logs.user_id = users.id 
        ORDER BY logs.timestamp DESC`;

    db.all(query, (err, rows) => {
        if (err) {
            console.error("Ошибка при получении логов:", err);
            return res.status(500).json({ success: false, message: "Ошибка при получении логов" });
        }
        res.json(rows);

        // Логируем действие просмотра логов
        logAction(req.user.id, "Просмотр логов");
    });
});

// Функция для генерации ключа
function generateKey() {
    return crypto.randomBytes(32).toString("hex");
}
const crypto = require("crypto");

// Функция для шифрования
function encryptData(data, key) {
    if (key.length !== 64) throw new Error(`Ошибка: ключ должен быть 32 байта (hex: 64 символа), получено ${key.length}`);

    const iv = crypto.randomBytes(16); // Генерируем IV (16 байт)
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    console.log("🔐 Зашифровано:", { iv: iv.toString("hex"), encrypted });

    return iv.toString("hex") + encrypted; // IV + шифрованные данные
}

// Функция для расшифровки
function decryptData(encryptedData, key) {
    if (key.length !== 64) throw new Error(`Ошибка: ключ должен быть 32 байта (hex: 64 символа), получено ${key.length}`);

    if (encryptedData.length < 32) throw new Error(`Ошибка: зашифрованные данные слишком короткие (${encryptedData.length} символов)`);

    const ivHex = encryptedData.slice(0, 32);
    const encryptedText = encryptedData.slice(32);

    const iv = Buffer.from(ivHex, "hex");
    if (iv.length !== 16) throw new Error(`Ошибка: IV должен быть 16 байт, получено ${iv.length} байт`);

    console.log("🔓 Расшифровка:", { iv: ivHex, encryptedText });

    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

// Регистрация пользователя
app.post("/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Необходимо указать имя пользователя и пароль" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const encryptionKey = generateKey(); // Ключ создается безопасно

        // Проверяем, существует ли пользователь
        db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, existingUser) => {
            if (err) {
                console.error("Ошибка при проверке пользователя:", err);
                return res.status(500).json({ success: false, message: "Ошибка сервера" });
            }
            if (existingUser) {
                return res.status(409).json({ success: false, message: "Имя пользователя уже занято" });
            }

            // Добавляем пользователя
            db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, 'user')`,
                [username, hashedPassword], function (err) {
                    if (err) {
                        console.error("Ошибка при регистрации пользователя:", err);
                        return res.status(500).json({ success: false, message: "Ошибка при регистрации" });
                    }

                    const userId = this.lastID;
                    db.run(`INSERT INTO encryption_keys (user_id, key) VALUES (?, ?)`,
                        [userId, encryptionKey], (err) => {
                            if (err) {
                                console.error("Ошибка при сохранении ключа шифрования:", err);
                                return res.status(500).json({ success: false, message: "Ошибка при генерации ключа" });
                            }

                            res.json({ success: true, message: "Регистрация успешна!" });
                            logAction(userId, "Новый Пользователь зарегистрирован в системе");
                        }
                    );
                }
            );
        });
    } catch (error) {
        console.error("Ошибка при хэшировании пароля или генерации ключа:", error);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
});

app.post("/userdata", (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Нет токена" });

        const decoded = jwt.verify(token, SECRET_KEY);
        let { datap, type_datap, comment } = req.body;

        // Нормализуем все поля
        datap = normalizeData(datap, "datap");
        type_datap = normalizeType(type_datap);
        comment = normalizeData(comment, "comment");

        // Проверка на отсутствие данных
        if (!datap || !type_datap || !comment) {
            return res.status(400).json({ success: false, message: "Отсутствуют или некорректны данные" });
        }

        db.get(`SELECT key FROM encryption_keys WHERE user_id = ?`, [decoded.id], (err, row) => {
            if (err) {
                console.error("Ошибка получения ключа:", err);
                return res.status(500).json({ success: false, message: "Ошибка шифрования" });
            }
            if (!row || !row.key) return res.status(400).json({ success: false, message: "Ключ шифрования не найден" });

            try {
                const encryptedDatap = encryptData(datap, row.key);
                const encryptedType = encryptData(type_datap, row.key);
                const encryptedComment = encryptData(comment, row.key);

                db.run(
                    `INSERT INTO data (user_id, datap, type_datap, comment) VALUES (?, ?, ?, ?)`,
                    [decoded.id, encryptedDatap, encryptedType, encryptedComment],
                    function (err) {
                        if (err) {
                            console.error("Ошибка записи данных:", err);
                            return res.status(500).json({ success: false, message: "Ошибка сохранения данных" });
                        }
                        res.json({ success: true, message: "Данные успешно сохранены" });
                    }
                );
            } catch (encryptError) {
                console.error("Ошибка при шифровании:", encryptError);
                return res.status(500).json({ success: false, message: "Ошибка шифрования данных" });
            }
        });
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});

app.get("/userdata", (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            console.log("Нет токена");
            return res.status(401).json({ success: false, message: "Нет токена" });
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        if (!decoded?.id) {
            console.log("Неверный токен");
            return res.status(401).json({ success: false, message: "Неверный токен" });
        }
        db.get(`SELECT key FROM encryption_keys WHERE user_id = ?`, [decoded.id], (err, row) => {
            if (err) {
                console.error("Ошибка получения ключа:", err);
                return res.status(500).json({ success: false, message: "Ошибка при получении ключа" });
            }
            if (!row || !row.key) {
                console.error("Ключ шифрования не найден");
                return res.status(400).json({ success: false, message: "Ключ шифрования не найден" });
            }
            db.all(`SELECT id, datap, type_datap, comment FROM data WHERE user_id = ?`, [decoded.id], (err, rows) => {
                if (err) {
                    console.error("Ошибка получения данных:", err);
                    return res.status(500).json({ success: false, message: "Ошибка получения данных" });
                }
                if (!rows || rows.length === 0) {
                    console.log("Нет данных для пользователя");
                    return res.json({ success: true, message: "Нет данных", data: [] });
                }
                try {
                    const decryptedRows = rows.map(entry => {
                        console.log("Encrypted data:", entry.datap);
                        const decryptedDatap = decryptData(entry.datap, row.key);
                        console.log("Decrypted data:", decryptedDatap);

                        return {
                            id: entry.id,
                            datap: decryptedDatap,
                            type_datap: decryptData(entry.type_datap, row.key),
                            comment: decryptData(entry.comment, row.key)
                        };
                    });
                    console.log("Отправляем клиенту:", { success: true, data: decryptedRows });
                    res.json({ success: true, data: decryptedRows });
                } catch (decryptError) {
                    console.error("Ошибка при расшифровке:", decryptError);
                    return res.status(500).json({ success: false, message: "Ошибка при расшифровке данных" });
                }
            });
        });
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});
app.delete("/userdata/:id", (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Нет токена" });

        const decoded = jwt.verify(token, SECRET_KEY);
        const recordId = Number(req.params.id);

        if (!Number.isInteger(recordId) || recordId <= 0) {
            return res.status(400).json({ success: false, message: "Некорректный ID" });
        }

        db.run(
            `DELETE FROM data WHERE id = ? AND user_id = ?`,
            [recordId, decoded.id],
            function (err) {
                if (err) {
                    console.error("Ошибка при удалении данных:", err);
                    return res.status(500).json({ success: false, message: "Ошибка удаления данных" });
                }
                if (!this || this.changes === 0) {
                    return res.status(404).json({ success: false, message: "Запись не найдена" });
                }
                logAction(decoded.id, `Удалены данные с ID ${recordId}`);
                res.json({ success: true, message: "Данные удалены" });
            }
        );
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});


app.put("/userdata/:id", (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Нет токена" });

        const decoded = jwt.verify(token, SECRET_KEY);
        const { datap, type_datap, comment } = req.body;
        const recordId = Number(req.params.id);

        if (!Number.isInteger(recordId) || recordId <= 0) {
            return res.status(400).json({ success: false, message: "Некорректный ID записи" });
        }

        db.get(`SELECT key FROM encryption_keys WHERE user_id = ?`, [decoded.id], (err, row) => {
            if (err) {
                console.error("Ошибка получения ключа:", err);
                return res.status(500).json({ success: false, message: "Ошибка при получении ключа" });
            }
            if (!row) return res.status(400).json({ success: false, message: "Ключ шифрования не найден" });

            try {
                // Нормализация типа данных
                const normalizedType = normalizeType(type_datap, dataTypes);
                const encryptedDatap = encryptData(datap, row.key);
                const encryptedType = encryptData(normalizedType, row.key);
                const encryptedComment = encryptData(comment, row.key);

                db.run(
                    `UPDATE data SET datap = ?, type_datap = ?, comment = ? WHERE id = ? AND user_id = ?`,
                    [encryptedDatap, encryptedType, encryptedComment, recordId, decoded.id],
                    function (err) {
                        if (err) {
                            console.error("Ошибка при обновлении данных:", err);
                            return res.status(500).json({ success: false, message: "Ошибка при обновлении данных" });
                        }
                        if (!this || this.changes === 0) {
                            return res.status(404).json({ success: false, message: "Запись не найдена" });
                        }
                        res.json({ success: true, message: "Данные обновлены" });
                    }
                );
            } catch (encryptError) {
                console.error("Ошибка при шифровании:", encryptError);
                res.status(500).json({ success: false, message: "Ошибка шифрования данных" });
            }
        });
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});
// Выход из системы
app.post("/logout", authenticateToken, (req, res) => {
    try {
        // Логируем действие выхода
        logAction(req.user.id, "Выход из системы");

        res.json({ success: true, message: "Выход выполнен" });
    } catch (error) {
        console.error("Ошибка при записи лога выхода:", error);
        res.status(500).json({ success: false, message: "Ошибка при выходе" });
    }
});
//Мониторинг

app.use(statusMonitor({
    title: "Мониторинг сервера", // Название страницы мониторинга
    path: "/status", // Путь для доступа к мониторингу
    spans: [
        { interval: 1, label: "1 секунда" }, // Метрики за последнюю секунду
        { interval: 10, label: "10 секунд" }, // Метрики за последние 10 секунд
        { interval: 60, label: "1 минута" } // Метрики за последнюю минуту
    ],
    chartOptions: {
        chart: {
            zoomType: "x"
        }
    }
}));
//Метод для расчета % ядер
const os = require("os");

function calculateTotalCpuTime() {
    const cpus = os.cpus();
    let totalCpuTime = 0;

    cpus.forEach(cpu => {
        for (const key in cpu.times) {
            totalCpuTime += cpu.times[key];
        }
    });

    return totalCpuTime; // Возвращает общее время работы CPU
}
app.get("/server-stats", authenticateToken, (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Доступ запрещён" });
    }

    const currentCpuUsage = process.cpuUsage();
    const cpuUserDelta = currentCpuUsage.user - lastCpuUsage.user;
    const cpuSystemDelta = currentCpuUsage.system - lastCpuUsage.system;

    // Рассчитываем общее время работы CPU
    const totalCpuTime = calculateTotalCpuTime();

    // Избегаем деления на ноль
    const cpuUsagePercent = totalCpuTime > 0
        ? ((cpuUserDelta + cpuSystemDelta) / totalCpuTime * 100).toFixed(2)
        : "0.00";

    // Обновляем предыдущее значение CPU Usage
    lastCpuUsage = currentCpuUsage;

    const memory = process.memoryUsage();

    const statsArray = [
        { label: "CPU Usage", value: `${cpuUsagePercent}%` },
        { label: "Heap Total", value: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB` },
        { label: "Heap Used", value: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB` },
        { label: "External Memory", value: `${(memory.external / 1024 / 1024).toFixed(2)} MB` },
        { label: "RSS Memory", value: `${(memory.rss / 1024 / 1024).toFixed(2)} MB` },
        { label: "Uptime", value: `${Math.floor(process.uptime() / 60)} минут` },
        { label: "Active Queries", value: db.profileCount || "Нет данных" }
    ];

    logAction(req.user.id, "Просмотр статистики сервера");

    res.json(statsArray);
});
app.post("/upload-file", authenticateToken, upload.single("file"), (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Нет токена" });

        const decoded = jwt.verify(token, SECRET_KEY);
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "Файл не выбран" });
        }

        db.get(`SELECT key FROM encryption_keys WHERE user_id = ?`, [decoded.id], (err, row) => {
            if (err) {
                console.error("Ошибка получения ключа:", err);
                return res.status(500).json({ success: false, message: "Ошибка при получении ключа" });
            }
            if (!row || !row.key) {
                return res.status(400).json({ success: false, message: "Ключ шифрования не найден" });
            }

            try {
                const encryptedFilename = encryptData(file.originalname, row.key); // Шифруем имя файла
                const encryptedContent = encryptBlob(file.buffer, row.key); // Шифруем содержимое файла

                db.run(
                    `INSERT INTO files (user_id, filename, content) VALUES (?, ?, ?)`,
                    [decoded.id, encryptedFilename, encryptedContent],
                    function (err) {
                        if (err) {
                            console.error("Ошибка записи файла:", err);
                            return res.status(500).json({ success: false, message: "Ошибка сохранения файла" });
                        }

                        logAction(decoded.id, "Файл загружен");
                        res.json({ success: true, message: "Файл успешно загружен" });
                    }
                );
            } catch (encryptError) {
                console.error("Ошибка при шифровании:", encryptError);
                return res.status(500).json({ success: false, message: "Ошибка шифрования данных" });
            }
        });
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});

// Функция для шифрования BLOB-данных
function encryptBlob(data, key) {
    if (key.length !== 64) throw new Error(`Ошибка: ключ должен быть 32 байта (hex: 64 символа), получено ${key.length}`);

    const iv = crypto.randomBytes(16); // Генерируем IV
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);

    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Добавляем IV к началу зашифрованных данных
    return Buffer.concat([iv, encrypted]);
}

// Функция для расшифровки BLOB-данных
function decryptBlob(encryptedData, key) {
    if (key.length !== 64) throw new Error(`Ошибка: ключ должен быть 32 байта (hex: 64 символа), получено ${key.length}`);

    const iv = encryptedData.slice(0, 16); // Извлекаем IV из первых 16 байт
    const data = encryptedData.slice(16); // Основные данные

    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
}
app.get("/files", authenticateToken, (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Нет токена" });

        const decoded = jwt.verify(token, SECRET_KEY);
        if (!decoded?.id) return res.status(401).json({ success: false, message: "Неверный токен" });

        console.log(`Запрос на получение файлов от пользователя ID=${decoded.id}`);

        const sql = `
            SELECT f.id, f.filename, f.uploaded_at, e.key
            FROM files f
            JOIN encryption_keys e ON f.user_id = e.user_id
            WHERE f.user_id = ?
        `;

        db.all(sql, [decoded.id], (err, rows) => {
            if (err) {
                console.error(`Ошибка получения файлов для пользователя ID=${decoded.id}:`, err);
                return res.status(500).json({ success: false, message: "Ошибка при получении файлов" });
            }
            console.log(`Файлы для пользователя ID=${decoded.id} загружены из базы данных`);
            if (!rows || rows.length === 0) {
                console.log(`У пользователя ID=${decoded.id} нет загруженных файлов`);
                return res.json({ success: true, data: [] });
            }
            try {
                const decryptedFiles = rows.map(row => {
                    try {
                        let decryptedFilename = decryptData(row.filename, row.key);

                        // Декодирование  в UTF-8
                        decryptedFilename = iconv.decode(Buffer.from(decryptedFilename, "binary"), "utf8");

                        console.log(`Файл ID=${row.id} успешно расшифрован: имя="${decryptedFilename}"`);
                        return { id: row.id, filename: decryptedFilename, uploaded_at: row.uploaded_at };
                    } catch (decryptError) {
                        console.error(`Ошибка при расшифровке файла ID=${row.id}:`, decryptError);
                        return { id: row.id, filename: "Ошибка расшифровки", uploaded_at: row.uploaded_at };
                    }
                });

                console.log(`Всего файлов для пользователя ID=${decoded.id}: ${rows.length}`);
                console.log(`Расшифрованные файлы для пользователя ID=${decoded.id}:`, decryptedFiles);
                logAction(decoded.id, "Просмотр файлов");

                res.json({ success: true, data: decryptedFiles });
            } catch (decryptError) {
                console.error(`Общая ошибка при расшифровке файлов для пользователя ID=${decoded.id}:`, decryptError);
                return res.status(500).json({ success: false, message: "Ошибка при расшифровке данных" });
            }
        });
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});

//Маршрут для скачивания файла
app.get("/files/:id", authenticateToken, (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Нет токена" });
        const decoded = jwt.verify(token, SECRET_KEY);
        const fileId = Number(req.params.id);
        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({ success: false, message: "Некорректный ID файла" });
        }

        db.get(
            `SELECT filename, content FROM files WHERE id = ? AND user_id = ?`,
            [fileId, decoded.id],
            (err, row) => {
                if (err) {
                    console.error("Ошибка получения файла:", err);
                    return res.status(500).json({ success: false, message: "Ошибка при получении файла" });
                }
                if (!row) {
                    return res.status(404).json({ success: false, message: "Файл не найден" });
                }

                db.get(`SELECT key FROM encryption_keys WHERE user_id = ?`, [decoded.id], (err, keyRow) => {
                    if (err) {
                        console.error("Ошибка получения ключа:", err);
                        return res.status(500).json({ success: false, message: "Ошибка при получении ключа" });
                    }
                    if (!keyRow || !keyRow.key) {
                        return res.status(400).json({ success: false, message: "Ключ шифрования не найден" });
                    }

                    try {
                        // Расшифровываем имя файла и содержимое
                        const decryptedFilename = decryptData(row.filename, keyRow.key); // Расшифровываем имя файла
                        const decryptedContent = decryptBlob(row.content, keyRow.key); // Расшифровываем содержимое файла

                        // Декодируем имя файла 
                        let decodedFilename = iconv.decode(Buffer.from(decryptedFilename, "binary"), "utf8");

                        // URL-кодирование имени файла для безопасного использования в заголовке
                        const encodedFilename = encodeURIComponent(decodedFilename);

                        // Устанавливаем заголовки для скачивания
                        res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"`);
                        res.setHeader("Content-Type", getMimeType(decodedFilename));
                        res.send(decryptedContent); // Отправляем расшифрованное содержимое
                    } catch (decryptError) {
                        console.error("Ошибка при расшифровке файла:", decryptError);
                        return res.status(500).json({ success: false, message: "Ошибка при расшифровке данных" });
                    }
                });
            }
        );
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});
// Функция для определения MIME-типа файла
function getMimeType(filename) {
    const extension = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
        txt: "text/plain",
        pdf: "application/pdf",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        zip: "application/zip",
        rar: "application/x-rar-compressed",
        "7z": "application/x-7z-compressed" // Ключ заключен в кавычки
    };

    return mimeTypes[extension] || "application/octet-stream"; // Возвращаем application/octet-stream для неизвестных типов
}
//Удаление файла
app.delete("/files/:id", authenticateToken, (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Нет токена" });

        const decoded = jwt.verify(token, SECRET_KEY);
        const fileId = Number(req.params.id);

        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({ success: false, message: "Некорректный ID файла" });
        }

        db.run(
            `DELETE FROM files WHERE id = ? AND user_id = ?`,
            [fileId, decoded.id],
            function (err) {
                if (err) {
                    console.error("Ошибка удаления файла:", err);
                    return res.status(500).json({ success: false, message: "Ошибка при удалении файла" });
                }
                if (!this || this.changes === 0) {
                    return res.status(404).json({ success: false, message: "Файл не найден" });
                }

                logAction(decoded.id, `Файл с ID ${fileId} удален`);
                res.json({ success: true, message: "Файл успешно удален" });
            }
        );
    } catch (error) {
        console.error("Ошибка аутентификации:", error);
        return res.status(401).json({ success: false, message: "Ошибка аутентификации" });
    }
});


console.log(app._router.stack.map(r => r.route && r.route.path).filter(Boolean));
// Запуск сервера
app.listen(3000, () => console.log("Сервер запущен на http://localhost:3000"));

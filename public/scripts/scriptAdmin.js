document.addEventListener("DOMContentLoaded", function () {
    window.logout = async function () {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Вы уже вышли из системы!");
                return;
            }

            // Отправляем запрос на сервер для регистрации события выхода
            const response = await fetch("/logout", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) {
                console.error("Ошибка при выходе:", await response.text());
                alert("Произошла ошибка при выходе.");
            } else {
                alert("Вы успешно вышли из системы.");
            }
        } catch (error) {
            console.error("Ошибка при выполнении запроса выхода:", error);
            alert("Не удалось связаться с сервером.");
        }

        // Удаляем токен и перенаправляем на страницу входа
        localStorage.removeItem("token");
        window.location.href = "index.html";
    };

    window.fetchServerStats = async function() {
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Вы не авторизованы!");
            return;
        }

        const response = await fetch("/server-stats", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        const statsArray = await response.json();

        const statsContainer = document.getElementById("stats-container");
        if (!statsContainer) {
            console.error("Контейнер для статистики не найден!");
            return;
        }

        statsContainer.innerHTML = "";

        const header = document.createElement("h3");
        header.textContent = "Статистика сервера";
        statsContainer.appendChild(header);

        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");

        const headerRow = document.createElement("tr");
        ["Метрика", "Значение"].forEach(text => {
            const th = document.createElement("th");
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        statsArray.forEach(stat => {
            const row = document.createElement("tr");
            const labelCell = document.createElement("td");
            labelCell.textContent = stat.label;
            const valueCell = document.createElement("td");
            valueCell.textContent = stat.value;
            row.appendChild(labelCell);
            row.appendChild(valueCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        statsContainer.appendChild(table);

        statsContainer.classList.remove("hidden");
        document.getElementById("users-container")?.classList.add("hidden");
        document.getElementById("log-container")?.classList.add("hidden");
        document.getElementById("create-user-form")?.classList.add("hidden");
    } catch (error) {
        console.error("Ошибка при загрузке статистики:", error);
        alert(`Ошибка: ${error.message}`);
    }
}
    // Функция для создания бэкапа
    window.backupData = async function () {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/backup", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Ошибка при создании бэкапа");
            alert("Бэкап успешно создан!");
        } catch (error) {
            console.error("Ошибка при создании бэкапа:", error);
            alert(`Ошибка: ${error.message}`);
        }
    };

    // Функция для удаления дубликатов
    window.removeDuplicates = async function () {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/remove-duplicates", {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Ошибка при удалении дубликатов");
            alert("Дубликаты успешно удалены!");
        } catch (error) {
            console.error("Ошибка при удалении дубликатов:", error);
            alert(`Ошибка: ${error.message}`);
        }
    };

    // Функция для просмотра пользователей
    window.viewUsers = async function () {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/users", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Ошибка при загрузке пользователей");
            const users = await response.json();

            const tableBody = document.querySelector("#users-table tbody");
            tableBody.innerHTML = "";

            users.forEach(user => {
                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td><button class="delete-btn" onclick="deleteUser(${user.id})">Удалить</button></td>
                `;

                tableBody.appendChild(row);
            });

            // Показываем таблицу пользователей
            document.getElementById("users-container").classList.remove("hidden");
            document.getElementById("log-container").classList.add("hidden");
            document.getElementById("create-user-form").classList.add("hidden");
            document.getElementById("stats-container").classList.add("hidden");
        } catch (error) {
            console.error("Ошибка при загрузке пользователей:", error);
            alert(`Ошибка: ${error.message}`);
        }
    };

    // Функция для просмотра логов
    window.viewLogs = async function () {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/logs", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Ошибка при загрузке логов");
            const logs = await response.json();

            const tableBody = document.querySelector("#logs-table tbody");
            tableBody.innerHTML = "";

            logs.forEach(log => {
                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${log.id}</td>
                    <td>${log.username || "Неизвестный"}</td>
                    <td>${log.action}</td>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                `;

                tableBody.appendChild(row);
            });

            // Показываем таблицу логов
            document.getElementById("log-container").classList.remove("hidden");
            document.getElementById("users-container").classList.add("hidden");
            document.getElementById("create-user-form").classList.add("hidden");
            document.getElementById("stats-container").classList.add("hidden");
        } catch (error) {
            console.error("Ошибка при загрузке логов:", error);
            alert(`Ошибка: ${error.message}`);
        }
    };

    // Функция для отображения формы создания пользователя
    window.showCreateUserForm = function () {
        document.getElementById("create-user-form").classList.remove("hidden");

        // Скрываем таблицы при открытии формы
        document.getElementById("users-container").classList.add("hidden");
        document.getElementById("log-container").classList.add("hidden");
        document.getElementById("stats-container").classList.add("hidden");
    };

    // Обработчик отправки формы создания пользователя
    document.getElementById("create-user").addEventListener("submit", async function (event) {
        event.preventDefault();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!username || !password) {
            alert("Заполните все поля!");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) throw new Error("Ошибка при создании пользователя");
            alert("Пользователь успешно создан!");

            // Скрываем форму после создания
            document.getElementById("create-user-form").classList.add("hidden");

            // Обновляем список пользователей
            viewUsers();
        } catch (error) {
            console.error("Ошибка при создании пользователя:", error);
            alert(`Ошибка: ${error.message}`);
        }
    });

    // Функция для удаления пользователя
    window.deleteUser = async function (userId) {
        if (!confirm("Вы уверены, что хотите удалить этого пользователя?")) return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Ошибка при удалении пользователя");
            alert("Пользователь успешно удален!");

            // Обновляем список пользователей
            viewUsers();
        } catch (error) {
            console.error("Ошибка при удалении пользователя:", error);
            alert(`Ошибка: ${error.message}`);
        }
    };
});
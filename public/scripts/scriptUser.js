document.addEventListener("DOMContentLoaded", function () {
    const dataForm = document.getElementById("add-form");
    const dataTypes = [
        "Фамилия", "Имя", "Отчество", "Дата рождения", "Адрес проживания",
        "Гражданство", "№ паспорта", "№ телефона", "Образование", "Место работы",
        "Пароль", "Логин", "Код", "Национальность", "Раса", "Взгляды на жизнь",
        "Политические взгляды", "Религиозные взгляды", "Любимый цвет",
        "Членство в профсоюзах", "Здоровье", "Половая жизнь", "Ориентация",
        "Биометрические данные", "Генетические данные", "Прочее"
    ];
    const elements = {
        view: document.getElementById("data-table-view"),
        edit: document.getElementById("data-table-edit"),
        add: document.getElementById("add-form"),
        upload: document.getElementById("upload-file-form"),
        files: document.getElementById("files-container")
    };
    window.fetchUserData = fetchUserData;
    window.showAddForm = showAddForm;
    window.showTableView = showTableView;
    window.showTableEdit = showTableEdit;
    window.showUploadFileForm = showUploadFileForm;
    window.showFiles = showFiles;
    window.fetchFiles = fetchFiles;
    window.downloadFile = downloadFile;
    window.deleteFile = deleteFile;
    window.logout = logout;
    window.updateData = updateData;
    let isEditableMode = false;
    function createSelect(value) {
        const select = document.createElement("select");
        dataTypes.forEach(type => {
            const option = document.createElement("option");
            option.value = type;
            option.textContent = type;
            if (type === value) option.selected = true;
            select.appendChild(option);
        });
        return select;
    }
    // Заполнение выпадающего списка типов данных
    const selectElement = document.getElementById("type_datap");
    dataTypes.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        selectElement.appendChild(option);
    });
    // Функция для показа таблицы просмотра данных
    function showTableView() {
        isEditableMode = false; // Режим просмотра
        toggleViews("view");
        fetchUserData(false); // Загружаем данные в режиме просмотра
    }

    // Функция для показа таблицы редактирования данных
    function showTableEdit() {
        isEditableMode = true; // Режим редактирования
        toggleViews("edit");
        fetchUserData(true); // Загружаем данные в режиме редактирования
    }

    // Функция для показа формы добавления данных
    function showAddForm() {
        isEditableMode = false; // Переходим в режим просмотра
        toggleViews("add");
    }

    // Функция для показа формы загрузки файлов
    function showUploadFileForm() {
        toggleViews("upload");
    }

    // Функция для показа таблицы файлов
    function showFiles() {
        toggleViews("files");
        fetchFiles(); // Загружаем список файлов
    }
    // Функция для переключения видимости элементов интерфейса
    function toggleViews(mode) {
        // скрываем все элементы перед отображением нового
        Object.values(elements).forEach(el => {
            if (el) el.style.display = "none";
        });
    
        // Отображаем только нужный элемент
        if (elements[mode]) {
            elements[mode].style.display = (mode === "view" || mode === "edit") ? "table" : "block";
        }
    }
    
    async function fetchUserData(isEditMode) {
        const loader = document.getElementById("loader");
        if (loader) loader.style.display = "block";

        try {
            const response = await fetch("/userdata", {
                method: "GET",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });

            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
            const responseData = await response.json();

            if (!responseData.success || !Array.isArray(responseData.data)) {
                throw new Error("Ошибка при получении данных");
            }

            if (isEditMode) {
                renderEditTable(responseData.data);
            } else {
                renderViewTable(responseData.data);
            }
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            alert(error.message);
        } finally {
            if (loader) loader.style.display = "none";
        }
    }
    function showTableView() {
        isTableViewVisible = true;
        isTableEditVisible = false;

        document.getElementById("data-table-view").style.display = "table";
        document.getElementById("data-table-edit").style.display = "none";

        fetchUserData(false); // Загружаем данные для просмотра
    }

    function showTableEdit() {
        isTableViewVisible = false;
        isTableEditVisible = true;

        document.getElementById("data-table-view").style.display = "none";
        document.getElementById("data-table-edit").style.display = "table";

        fetchUserData(true); // Загружаем данные для редактирования
    }
    function createTd(...elements) {
        const td = document.createElement("td");
        elements.forEach(element => {
            if (element && typeof element === "object" && element.nodeType === Node.ELEMENT_NODE) {
                td.appendChild(element);
            } else if (typeof element === "string" || typeof element === "number") {
                // Если передана строка или число, создаем текстовый узел
                td.appendChild(document.createTextNode(String(element)));
            }
        });
        return td;
    }
    function renderViewTable(data) {
        const table = document.getElementById("data-table-view");
        if (!table) {
            console.error("Ошибка: Таблица просмотра не найдена!");
            return;
        }
        const tableBody = table.querySelector("tbody");
        if (!tableBody) {
            console.error("Ошибка: tbody отсутствует в таблице просмотра");
            return;
        }
        tableBody.innerHTML = "";
        const fragment = document.createDocumentFragment();

        data.forEach(entry => {
            if (!entry.id || isNaN(entry.id)) return;

            const row = document.createElement("tr");

            row.appendChild(createTd(entry.id));
            row.appendChild(createTd(entry.datap));
            row.appendChild(createTd(entry.type_datap));
            row.appendChild(createTd(entry.comment));
            fragment.appendChild(row);
        });

        tableBody.appendChild(fragment);
    }

    function renderEditTable(data) {
        const table = document.getElementById("data-table-edit");
        if (!table) {
            console.error("Ошибка: Таблица редактирования не найдена!");
            return;
        }

        const tableBody = table.querySelector("tbody");
        if (!tableBody) {
            console.error("Ошибка: tbody отсутствует в таблице редактирования");
            return;
        }

        tableBody.innerHTML = "";
        const fragment = document.createDocumentFragment();

        data.forEach(entry => {
            if (!entry.id || isNaN(entry.id)) return;

            const row = document.createElement("tr");

            const idCell = document.createElement("td");
            idCell.textContent = entry.id;
            row.appendChild(idCell);

            const inputDatap = document.createElement("input");
            inputDatap.type = "text";
            inputDatap.value = entry.datap;
            inputDatap.id = `datap-${entry.id}`;
            row.appendChild(createTd(inputDatap));

            const selectType = createSelect(entry.type_datap);
            row.appendChild(createTd(selectType));

            const inputComment = document.createElement("input");
            inputComment.type = "text";
            inputComment.value = entry.comment;
            inputComment.id = `comment-${entry.id}`;
            row.appendChild(createTd(inputComment));

            const saveButton = document.createElement("button");
            saveButton.textContent = "💾 Сохранить";
            saveButton.onclick = () => updateData(entry.id);

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "🗑 Удалить";
            deleteButton.onclick = () => deleteData(entry.id);

            row.appendChild(createTd(saveButton, deleteButton));

            fragment.appendChild(row);
        });

        tableBody.appendChild(fragment);
    }
    //Функция добавления
    async function addData(event) {
        event.preventDefault();
        const datap = document.getElementById("datap").value.trim();
        const type_datap = document.getElementById("type_datap").value.trim();
        const comment = document.getElementById("comment").value.trim();
        const token = localStorage.getItem("token");

        if (!datap || !type_datap || !comment) {
            alert("Все поля должны быть заполнены!");
            return;
        }
        try {
            const response = await fetch("/userdata", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ datap, type_datap, comment })
            });

            if (!response.ok) throw new Error("Ошибка при добавлении данных");
            alert("Данные успешно добавлены!");

            // Очищаем форму после добавления
            document.getElementById("datap").value = "";
            document.getElementById("type_datap").value = "";
            document.getElementById("comment").value = "";
            fetchUserData(true);
        } catch (error) {
            console.error("Ошибка при добавлении данных:", error);
            alert(error.message);
        }
    }
    //Функция обновления записи
    async function updateData(id) {
        const datap = document.getElementById(`datap-${id}`).value.trim();
        const row = document.getElementById(`datap-${id}`).closest("tr");
        const type_datap = row.querySelector("select").value.trim();
        const comment = document.getElementById(`comment-${id}`).value.trim();
        const token = localStorage.getItem("token");

        if (!datap || !type_datap || !comment) {
            alert("Все поля должны быть заполнены!");
            return;
        }

        try {
            const response = await fetch(`/userdata/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ datap, type_datap, comment })
            });

            if (!response.ok) throw new Error("Ошибка при редактировании данных");
            alert("Данные успешно обновлены!");
            fetchUserData(true);
        } catch (error) {
            console.error("Ошибка при редактировании данных:", error);
            alert("Ошибка при редактировании данных");
        }
    };
    //Функция удаления записи
    async function deleteData(id) {
        if (!confirm("Удалить запись?")) return;
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`/userdata/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Ошибка при удалении данных");
            alert("Данные успешно удалены!");
            fetchUserData(true);
        } catch (error) {
            console.error("Ошибка при удалении данных:", error);
            alert("Ошибка при удалении данных");
        }
    };
    // Функция выхода
    async function logout() {
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
    //Функция отправки файла
    document.getElementById("upload-file-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        const fileInput = document.getElementById("file");
        const file = fileInput.files[0];

        if (!file) {
            alert("Выберите файл!");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Вы не авторизованы!");
                return;
            }

            const response = await fetch("/upload-file", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
            alert("Файл успешно загружен!");
            fetchFiles(); // Обновляем список файлов
        } catch (error) {
            console.error("Ошибка при загрузке файла:", error);
            alert(`Ошибка: ${error.message}`);
        }
    });
    // Функция загрузки файла
    async function fetchFiles() {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Вы не авторизованы!");
                return;
            }

            const response = await fetch("/files", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

            // Получаем массив файлов напрямую или из поля data
            const jsonResponse = await response.json();
            const files = Array.isArray(jsonResponse) ? jsonResponse : jsonResponse.data;

            const tableBody = document.querySelector("#files-table tbody");
            if (!tableBody) {
                console.error("Контейнер для файлов не найден!");
                return;
            }

            tableBody.innerHTML = "";

            files.forEach(file => {
                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${file.id}</td>
                    <td>${file.filename}</td>
                    <td>${new Date(file.uploaded_at).toLocaleString()}</td>
                    <td>
                        <button onclick="downloadFile(${file.id})">Скачать</button>
                        <button onclick="deleteFile(${file.id})">Удалить</button>
                    </td>
                `;

                tableBody.appendChild(row);
            });

            document.getElementById("files-container").classList.remove("hidden");
        } catch (error) {
            console.error("Ошибка при получении файлов:", error);
            alert(`Ошибка: ${error.message}`);
        }
    };
    // Функция для скачивания файла
async function downloadFile(id) {
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Вы не авторизованы!");
            return;
        }

        const response = await fetch(`/files/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.message || `Ошибка сервера: ${response.status}`;
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition");
        const filenameMatch = disposition && disposition.match(/filename="(.+)"/);
        const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : "file";

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Ошибка при скачивании файла:", error);
        alert(`Ошибка: ${error.message}`);
    }
}
    // Удаление файла
    async function deleteFile(id) {
        if (!confirm("Вы уверены, что хотите удалить этот файл?")) return;

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Вы не авторизованы!");
                return;
            }

            const response = await fetch(`/files/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
            alert("Файл успешно удален!");
            fetchFiles(); // Обновляем список файлов
        } catch (error) {
            console.error("Ошибка при удалении файла:", error);
            alert(`Ошибка: ${error.message}`);
        }
    };
    if (dataForm) {
        dataForm.addEventListener("submit", addData);
    }
});

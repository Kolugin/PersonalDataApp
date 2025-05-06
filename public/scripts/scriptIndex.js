document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;

            try {
                const res = await fetch("/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (data.success) {
                    localStorage.setItem("token", data.token);
                    window.location.href = data.role === "admin" ? "admin.html" : "user.html";
                } else {
                    document.getElementById("message").innerText = "Неверные данные!";
                }
            } catch (error) {
                console.error("Ошибка авторизации:", error);
            }
        });
    }
});
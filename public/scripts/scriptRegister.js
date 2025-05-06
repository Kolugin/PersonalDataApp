document.addEventListener("DOMContentLoaded", function () {
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;
            const message = document.getElementById("message");

            if (password !== confirmPassword) {
                message.textContent = "Пароли не совпадают!";
                message.style.color = "red";
                return;
            }

            try {
                const response = await fetch("http://localhost:3000/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();
                message.textContent = result.message;
                message.style.color = result.success ? "green" : "red";

                if (result.success) {
                    setTimeout(() => { window.location.href = "index.html"; }, 2000);
                }
            } catch (error) {
                console.error("Ошибка регистрации:", error);
            }
        });
    }
});
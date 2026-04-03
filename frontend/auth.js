const API_URL = "http://localhost:5000/api/auth";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            const btn = loginForm.querySelector("button");
            
            btn.innerText = "Verifying Credentials...";
            btn.disabled = true;

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("user", JSON.stringify(data.user));
                    window.location.href = "dashboard.html";
                } else {
                    alert(data.message || "Authentication Failed");
                }
            } catch (err) {
                alert("Vault connection error. Check server status.");
            } finally {
                btn.innerText = "Secure Login";
                btn.disabled = false;
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value.trim();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;

            const btn = signupForm.querySelector("button");
            btn.innerText = "Onboarding...";
            btn.disabled = true;

            try {
                const res = await fetch(`${API_URL}/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await res.json();

                if (res.ok) {
                    alert("Onboarding Complete. Please authenticate to continue.");
                    window.location.href = "index.html";
                } else {
                    alert(data.message || "Onboarding Failed");
                }
            } catch (err) {
                alert("Registration server offline.");
            } finally {
                btn.innerText = "Register Firm";
                btn.disabled = false;
            }
        });
    }
});
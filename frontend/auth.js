/* ---------- LOGIN ---------- */
async function login() {
  console.log("Login triggered");

  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();
//   const role = document.getElementById("loginRole").value;
  const error = document.getElementById("loginError");

  error.style.display = "none";

  // Validation
  if (!user || !pass) {
    error.innerText = "Please fill all the fields";
    error.style.display = "block";
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: user,
        password: pass
      })
    });

    console.log("Status:", res.status);

    const data = await res.json();
    console.log("Response:", data);

    // ❌ Handle backend error properly
    if (!res.ok) {
      error.innerText = data.message || "Login failed";
      error.style.display = "block";
      return;
    }

    if (data.token) {
      localStorage.setItem("token", data.token);
    }
    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.user.username) localStorage.setItem("username", data.user.username);
    }
    localStorage.setItem("userEmail", user);
    //localStorage.setItem("role", role);

    // ❌ REMOVE alert (can block redirect sometimes)
    // alert("Login successful 🎉");

    // ✅ FORCE redirect (better than href)
    window.location.replace("./Dashboard.html");

  } catch (err) {
    console.error("Login error:", err);
    error.innerText = "Server error. Please try again.";
    error.style.display = "block";
  }
}


/* ---------- SIGNUP ---------- */
async function signup() {
  const user = document.getElementById("signupUser").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const pass = document.getElementById("signupPass").value.trim();
  const confirmPass = document.getElementById("signupPassconf").value.trim();
  const error = document.getElementById("signupError");

  error.style.display = "none";

  // Validation
  if (!user || !email || !pass || !confirmPass) {
    error.innerText = "All fields are required";
    error.style.display = "block";
    return;
  }

  if (pass !== confirmPass) {
    error.innerText = "Passwords do not match";
    error.style.display = "block";
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: user,
        email: email,
        password: pass
      })
    });

    console.log("Signup Status:", res.status);

    const data = await res.json();
    console.log("Signup Response:", data);

    if (!res.ok) {
      error.innerText = data.message || "Signup failed";
      error.style.display = "block";
      return;
    }

    alert("Signup successful ✅");

    // Redirect to login
    window.location.replace("index.html");

  } catch (err) {
    console.error("Signup error:", err);
    error.innerText = "Server error. Please try again.";
    error.style.display = "block";
  }
}
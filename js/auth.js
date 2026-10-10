
const Auth = (() => {
    const current = () => DB.getSession();

    const user = () => {
        const session = current();

        return session
            ? DB.getUsers().find(
                item => item.id === session.userId
            ) || null
            : null;
    };

    const isAdmin = () => user()?.role === "ADMIN";

    function renderHeader() {
        const target = document.getElementById("account-actions");

        if (!target) return;

        const currentUser = user();

        if (currentUser) {
            target.innerHTML = `
                ${isAdmin()
                    ? '<a href="admin/index.html">Dashboard</a>'
                    : ""}
                <span class="muted">
                    Hi, ${escapeHTML(currentUser.name.split(" ")[0])}
                </span>
                <button class="btn btn-light" id="logout-btn">
                    Logout
                </button>
            `;

            document.getElementById("logout-btn")
                ?.addEventListener("click", logout);
        } else {
            target.innerHTML = `
                <a href="login.html">Login</a>
                <a class="btn btn-dark" href="register.html">Join us</a>
            `;
        }

        const wishlistCount = document.getElementById("wish-count");

        if (wishlistCount) {
            wishlistCount.textContent = DB.getWishlist().length;
        }

        const cartCount = document.getElementById("cart-count");

        if (cartCount) {
            cartCount.textContent = DB.getCart().reduce(
                (sum, item) => sum + item.quantity,
                0
            );
        }
    }

    function logout() {
        DB.clearSession();
        location.href = location.pathname.includes("/admin/")
            ? "../login.html"
            : "login.html";
    }

    function requireLogin() {
        if (!user()) {
            location.href = location.pathname.includes("/admin/")
                ? "../login.html"
                : "login.html";

            return false;
        }

        return true;
    }

    function requireAdmin() {
        if (!user()) {
            location.href = "../login.html";
            return false;
        }

        if (!isAdmin()) {
            alert("Admin access only.");
            location.href = "../index.html";
            return false;
        }

        return true;
    }

    function showErrors(form, errors) {
        form.querySelectorAll("[data-error]").forEach(element => {
            element.textContent = "";
        });

        for (const [field, message] of Object.entries(errors)) {
            const element = form.querySelector(
                `[data-error="${field}"]`
            );

            if (element) element.textContent = message;
        }
    }

    function initLogin() {
        const form = document.getElementById("login-form");

        if (!form) return;

        form.addEventListener("submit", event => {
            event.preventDefault();

            const data = Object.fromEntries(new FormData(form));
            const errors = {};

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) {
                errors.email = "Enter a valid email address.";
            }

            if (!data.password) {
                errors.password = "Password is required.";
            }

            showErrors(form, errors);

            const formError = document.getElementById("form-error");
            formError.textContent = "";

            if (Object.keys(errors).length) return;

            const found = DB.getUsers().find(
                item =>
                    item.email.toLowerCase() === data.email.trim().toLowerCase() &&
                    item.password === data.password
            );

            if (!found) {
                formError.textContent = "Email or password is incorrect.";
                return;
            }

            DB.saveSession({
                userId: found.id,
                loginAt: new Date().toISOString()
            });

            location.href = found.role === "ADMIN"
                ? "admin/index.html"
                : "index.html";
        });
    }

    function initRegister() {
        const form = document.getElementById("register-form");

        if (!form) return;

        form.addEventListener("submit", event => {
            event.preventDefault();

            const data = Object.fromEntries(new FormData(form));
            const errors = {};

            if ((data.name || "").trim().length < 2) {
                errors.name = "Name must contain at least 2 characters.";
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) {
                errors.email = "Enter a valid email address.";
            }

            if ((data.password || "").length < 8) {
                errors.password = "Password must be at least 8 characters.";
            } else if (
                !/[A-Za-z]/.test(data.password) ||
                !/[0-9]/.test(data.password)
            ) {
                errors.password = "Use at least one letter and one number.";
            }

            if (data.confirmPassword !== data.password) {
                errors.confirmPassword = "Passwords do not match.";
            }

            showErrors(form, errors);

            const formError = document.getElementById("form-error");
            formError.textContent = "";

            if (Object.keys(errors).length) return;

            const email = data.email.trim().toLowerCase();
            const users = DB.getUsers();

            if (users.some(item => item.email.toLowerCase() === email)) {
                form.querySelector('[data-error="email"]').textContent =
                    "An account with this email already exists.";
                return;
            }

            const newUser = {
                id: DB.id("user"),
                name: data.name.trim(),
                email,
                password: data.password,
                role: "CUSTOMER"
            };

            users.push(newUser);
            DB.saveUsers(users);

            DB.saveSession({
                userId: newUser.id,
                loginAt: new Date().toISOString()
            });

            location.href = "index.html";
        });
    }

    return {
        current,
        user,
        isAdmin,
        renderHeader,
        requireLogin,
        requireAdmin,
        initLogin,
        initRegister
    };
})();

document.addEventListener("DOMContentLoaded", Auth.renderHeader);

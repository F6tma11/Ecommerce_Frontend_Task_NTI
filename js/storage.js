
const DB = (() => {
    const KEYS = {
        users: "cozycart_users",
        products: "cozycart_products",
        categories: "cozycart_categories",
        orders: "cozycart_orders",
        cart: "cozycart_cart",
        wishlist: "cozycart_wishlist",
        session: "cozycart_session"
    };

    const read = (key, fallback = []) => {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch {
            return fallback;
        }
    };

    const write = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };

    const id = (prefix = "id") =>
        `${prefix}_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    function seed() {
        if (!localStorage.getItem(KEYS.users)) {
            write(KEYS.users, [{
                id: "user_admin",
                name: "Store Admin",
                email: "admin@cozycart.com",
                password: "Admin123!",
                role: "ADMIN"
            }]);
        }

        for (const key of [
            KEYS.products,
            KEYS.categories,
            KEYS.orders,
            KEYS.cart,
            KEYS.wishlist
        ]) {
            if (!localStorage.getItem(key)) {
                write(key, []);
            }
        }
    }

    seed();

    return {
        id,

        getUsers: () => read(KEYS.users),
        saveUsers: value => write(KEYS.users, value),

        getProducts: () => read(KEYS.products),
        saveProducts: value => write(KEYS.products, value),

        getCategories: () => read(KEYS.categories),
        saveCategories: value => write(KEYS.categories, value),

        getOrders: () => read(KEYS.orders),
        saveOrders: value => write(KEYS.orders, value),

        getCart: () => read(KEYS.cart),
        saveCart: value => write(KEYS.cart, value),

        getWishlist: () => read(KEYS.wishlist),
        saveWishlist: value => write(KEYS.wishlist, value),

        getSession: () => read(KEYS.session, null),
        saveSession: value => write(KEYS.session, value),

        clearSession: () => localStorage.removeItem(KEYS.session)
    };
})();

const money = value =>
    new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: "EGP",
        maximumFractionDigits: 2
    }).format(Number(value) || 0);

const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));

const categoryName = id =>
    DB.getCategories().find(
        category => String(category.id) === String(id)
    )?.name || "Uncategorized";

function toast(message) {
    let element = document.getElementById("toast");

    if (!element) {
        element = document.createElement("div");
        element.id = "toast";
        element.className = "toast";
        document.body.append(element);
    }

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
        element.classList.remove("show");
    }, 2600);
}

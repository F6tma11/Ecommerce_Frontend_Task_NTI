
const Store = (() => {
    let selectedCategory = "";
    let initialized = false;

    const products = () => DB.getProducts();

    async function initialize() {
        if (initialized) return;

        const grid = document.getElementById("product-grid");

        try {
            await ProductAPI.initialize();
            initialized = true;

            renderCategories();
            renderProducts();
            Auth.renderHeader();
        } catch (error) {
            console.error(error);

            if (grid) {
                grid.innerHTML = `
                    <p class="empty">
                        Could not load products. Please refresh the page.
                    </p>
                `;
            }
        }
    }

    function card(product) {
        const wished = DB.getWishlist().includes(product.id);

        return `
            <article class="product-card">
                <div class="product-image-wrap">
                    <img
                        class="product-image"
                        src="${escapeHTML(product.image)}"
                        alt="${escapeHTML(product.name)}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='https://placehold.co/600x700/f2e9df/252323?text=Product'"
                    >

                    <button
                        class="wish-btn ${wished ? "active" : ""}"
                        data-wish="${escapeHTML(product.id)}"
                        aria-label="Toggle wishlist"
                    >
                        ${wished ? "♥" : "♡"}
                    </button>
                </div>

                <div class="product-info">
                    <span class="product-category">
                        ${escapeHTML(categoryName(product.categoryId))}
                    </span>

                    <h3 class="product-name">
                        ${escapeHTML(product.name)}
                    </h3>

                    <p class="product-description">
                        ${escapeHTML(product.description)}
                    </p>

                    <div class="product-bottom">
                        <span class="price">${money(product.price)}</span>

                        <button
                            class="add-btn"
                            data-add="${escapeHTML(product.id)}"
                            ${product.stock < 1 ? "disabled" : ""}
                        >
                            ${product.stock < 1 ? "Sold out" : "Add to cart"}
                        </button>
                    </div>

                    <p class="muted">${product.stock} in stock</p>
                </div>
            </article>
        `;
    }

    function bindCards(root) {
        root.querySelectorAll("[data-wish]").forEach(button => {
            button.onclick = () => toggleWishlist(button.dataset.wish);
        });

        root.querySelectorAll("[data-add]").forEach(button => {
            button.onclick = () => addToCart(button.dataset.add);
        });
    }

    function toggleWishlist(id) {
        id = String(id);

        let wishlist = DB.getWishlist();

        if (wishlist.includes(id)) {
            wishlist = wishlist.filter(item => item !== id);
            toast("Removed from wishlist.");
        } else {
            wishlist.push(id);
            toast("Added to wishlist.");
        }

        DB.saveWishlist(wishlist);
        Auth.renderHeader();

        if (document.getElementById("product-grid")) renderProducts();
        if (document.getElementById("wishlist-grid")) renderWishlist();
    }

    function addToCart(id) {
        id = String(id);

        const product = products().find(item => item.id === id);

        if (!product) return;

        const cart = DB.getCart();
        const item = cart.find(entry => entry.productId === id);
        const quantity = item?.quantity || 0;

        if (quantity >= product.stock) {
            toast("You have reached the available stock.");
            return;
        }

        if (item) {
            item.quantity++;
        } else {
            cart.push({ productId: id, quantity: 1 });
        }

        DB.saveCart(cart);
        Auth.renderHeader();
        toast("Added to cart.");
    }

    function renderCategories() {
        const chips = document.getElementById("category-chips");
        const select = document.getElementById("category-filter");

        if (!chips || !select) return;

        const categories = DB.getCategories();

        chips.innerHTML = `
            <button class="chip ${!selectedCategory ? "active" : ""}" data-cat="">
                All
            </button>
        ` + categories.map(category => `
            <button
                class="chip ${selectedCategory === category.id ? "active" : ""}"
                data-cat="${escapeHTML(category.id)}"
            >
                ${escapeHTML(category.name)}
            </button>
        `).join("");

        select.innerHTML = '<option value="">All categories</option>' +
            categories.map(category => `
                <option value="${escapeHTML(category.id)}">
                    ${escapeHTML(category.name)}
                </option>
            `).join("");

        select.value = selectedCategory;

        chips.querySelectorAll("[data-cat]").forEach(button => {
            button.onclick = () => {
                selectedCategory = button.dataset.cat;
                renderCategories();
                renderProducts();
            };
        });

        select.onchange = () => {
            selectedCategory = select.value;
            renderCategories();
            renderProducts();
        };
    }

    function renderProducts() {
        const grid = document.getElementById("product-grid");

        if (!grid) return;

        const query = (
            document.getElementById("search")?.value || ""
        ).trim().toLowerCase();

        const sort = document.getElementById("sort")?.value || "featured";

        let list = products().filter(product => {
            const categoryMatches =
                !selectedCategory ||
                product.categoryId === selectedCategory;

            const text = `
                ${product.name}
                ${product.description}
                ${categoryName(product.categoryId)}
            `.toLowerCase();

            return categoryMatches && text.includes(query);
        });

        if (sort === "price-low") {
            list.sort((a, b) => a.price - b.price);
        }

        if (sort === "price-high") {
            list.sort((a, b) => b.price - a.price);
        }

        if (sort === "name") {
            list.sort((a, b) => a.name.localeCompare(b.name));
        }

        grid.innerHTML = list.map(card).join("");

        document.getElementById("empty-state")
            ?.classList.toggle("hidden", list.length > 0);

        const count = document.getElementById("result-count");

        if (count) {
            count.textContent =
                `${list.length} product${list.length === 1 ? "" : "s"}`;
        }

        bindCards(grid);
    }

    function renderWishlist() {
        Auth.renderHeader();

        const grid = document.getElementById("wishlist-grid");

        if (!grid) return;

        const list = DB.getWishlist()
            .map(id => products().find(product => product.id === String(id)))
            .filter(Boolean);

        grid.innerHTML = list.map(card).join("");

        document.getElementById("wishlist-empty")
            ?.classList.toggle("hidden", list.length > 0);

        bindCards(grid);
    }

    function renderCart() {
        Auth.renderHeader();

        const root = document.getElementById("cart-items");
        const summary = document.getElementById("cart-summary");

        if (!root || !summary) return;

        const cart = DB.getCart().filter(item =>
            products().some(product => product.id === String(item.productId))
        );

        DB.saveCart(cart);

        root.innerHTML = cart.map(item => {
            const product = products().find(
                entry => entry.id === String(item.productId)
            );

            return `
                <div class="cart-row">
                    <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}">

                    <div>
                        <h3>${escapeHTML(product.name)}</h3>
                        <p class="muted">${money(product.price)} each</p>

                        <div class="quantity">
                            <button data-qty="${product.id}" data-delta="-1">−</button>
                            <span>${item.quantity}</span>
                            <button
                                data-qty="${product.id}"
                                data-delta="1"
                                ${item.quantity >= product.stock ? "disabled" : ""}
                            >+</button>
                            <button class="btn btn-danger" data-remove="${product.id}">
                                Remove
                            </button>
                        </div>
                    </div>

                    <span class="price">
                        ${money(product.price * item.quantity)}
                    </span>
                </div>
            `;
        }).join("");

        document.getElementById("cart-empty")
            ?.classList.toggle("hidden", cart.length > 0);

        const total = cart.reduce((sum, item) => {
            const product = products().find(
                entry => entry.id === String(item.productId)
            );

            return sum + product.price * item.quantity;
        }, 0);

        summary.innerHTML = cart.length ? `
            <h2>Order summary</h2>

            <div class="summary-line">
                <span>Subtotal</span>
                <strong>${money(total)}</strong>
            </div>

            <div class="summary-line">
                <span>Shipping</span>
                <span>Free</span>
            </div>

            <div class="summary-line">
                <strong>Total</strong>
                <strong>${money(total)}</strong>
            </div>

            <p class="muted">
                Your order will be pending until an admin reviews it.
            </p>

            <button class="btn btn-dark" id="checkout-btn">Place order</button>
            <a class="btn btn-light" href="index.html">Continue shopping</a>
        ` : "";

        root.querySelectorAll("[data-qty]").forEach(button => {
            button.onclick = () => changeQuantity(
                button.dataset.qty,
                Number(button.dataset.delta)
            );
        });

        root.querySelectorAll("[data-remove]").forEach(button => {
            button.onclick = () => {
                DB.saveCart(DB.getCart().filter(
                    item => item.productId !== button.dataset.remove
                ));

                renderCart();
                Auth.renderHeader();
            };
        });

        document.getElementById("checkout-btn")
            ?.addEventListener("click", checkout);
    }

    function changeQuantity(id, delta) {
        id = String(id);

        const cart = DB.getCart();
        const item = cart.find(entry => entry.productId === id);
        const product = products().find(entry => entry.id === id);

        if (!item || !product) return;

        const newQuantity = item.quantity + delta;

        if (newQuantity < 1) {
            DB.saveCart(cart.filter(entry => entry.productId !== id));
        } else if (newQuantity > product.stock) {
            toast("Not enough stock.");
            return;
        } else {
            item.quantity = newQuantity;
            DB.saveCart(cart);
        }

        renderCart();
        Auth.renderHeader();
    }

    function checkout() {
        if (!Auth.requireLogin()) return;

        const cart = DB.getCart();

        if (!cart.length) return;

        for (const item of cart) {
            const product = products().find(
                entry => entry.id === String(item.productId)
            );

            if (!product || product.stock < item.quantity) {
                toast(`Insufficient stock for ${product?.name || "a product"}.`);
                return;
            }
        }

        const currentUser = Auth.user();

        const items = cart.map(item => {
            const product = products().find(
                entry => entry.id === String(item.productId)
            );

            return {
                productId: product.id,
                name: product.name,
                image: product.image,
                price: product.price,
                quantity: item.quantity
            };
        });

        const order = {
            id: DB.id("order"),
            customerId: currentUser.id,
            customerName: currentUser.name,
            customerEmail: currentUser.email,
            items,
            total: items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            ),
            status: "PENDING",
            createdAt: new Date().toISOString()
        };

        DB.saveOrders([order, ...DB.getOrders()]);
        DB.saveCart([]);

        Auth.renderHeader();
        toast("Order placed successfully.");

        setTimeout(() => {
            location.href = "my-orders.html";
        }, 650);
    }

    function renderMyOrders() {
        Auth.renderHeader();

        if (!Auth.requireLogin()) return;

        const root = document.getElementById("orders-list");

        if (!root) return;

        const list = DB.getOrders().filter(
            order => order.customerId === Auth.user().id
        );

        document.getElementById("orders-empty")
            ?.classList.toggle("hidden", list.length > 0);

        root.innerHTML = list.map(order => `
            <article class="order-card">
                <div class="order-head">
                    <h3>Order ${escapeHTML(order.id)}</h3>
                    <span class="status ${order.status.toLowerCase()}">
                        ${escapeHTML(order.status)}
                    </span>
                </div>

                <p class="muted">
                    ${new Date(order.createdAt).toLocaleString()}
                </p>

                <div class="order-items">
                    ${order.items.map(item => `
                        ${escapeHTML(item.name)} × ${item.quantity}
                        — ${money(item.price * item.quantity)}
                    `).join("<br>")}
                </div>

                <div class="order-head">
                    <span class="muted">
                        ${order.items.reduce((sum, item) => sum + item.quantity, 0)}
                        item(s)
                    </span>
                    <strong>${money(order.total)}</strong>
                </div>
            </article>
        `).join("");
    }

    document.addEventListener("DOMContentLoaded", async () => {
        await initialize();

        document.getElementById("search")
            ?.addEventListener("input", renderProducts);

        document.getElementById("sort")
            ?.addEventListener("change", renderProducts);

        if (document.getElementById("wishlist-grid")) renderWishlist();
        if (document.getElementById("cart-items")) renderCart();
        if (document.getElementById("orders-list")) renderMyOrders();
    });

    return {
        initialize,
        renderProducts,
        renderWishlist,
        renderCart,
        renderMyOrders
    };
})();

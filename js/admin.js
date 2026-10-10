
document.addEventListener("DOMContentLoaded", async () => {
    if (!Auth.requireAdmin()) return;

    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    const productForm = $("#product-form");
    const productError = $("#product-error");

    try {
        await ProductAPI.initialize();
    } catch (error) {
        $("#admin-product-list").textContent =
            "Could not load products. Check your internet connection.";
        console.error(error);
        return;
    }

    const tabs = $$(".tab");
    const panels = $$(".admin-panel");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(item =>
                item.classList.toggle("active", item === tab)
            );

            panels.forEach(panel =>
                panel.classList.toggle(
                    "hidden",
                    panel.id !== `admin-${tab.dataset.tab}`
                )
            );

            if (tab.dataset.tab === "orders") renderOrders();
        });
    });

    function fillCategories(selected = "") {
        const select = productForm.elements.categoryId;

        select.innerHTML = '<option value="">Choose category</option>' +
            DB.getCategories().map(category => `
                <option value="${escapeHTML(category.id)}">
                    ${escapeHTML(category.name)}
                </option>
            `).join("");

        select.value = selected;
    }

    function renderProducts() {
        const root = $("#admin-product-list");
        const products = DB.getProducts();

        root.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => `
                        <tr>
                            <td>
                                <div class="table-product">
                                    <img src="${escapeHTML(product.image)}" alt="">
                                    <strong>${escapeHTML(product.name)}</strong>
                                </div>
                            </td>
                            <td>${escapeHTML(categoryName(product.categoryId))}</td>
                            <td>${money(product.price)}</td>
                            <td class="${product.stock < 5 ? "stock-low" : ""}">
                                ${product.stock}
                            </td>
                            <td>
                                <button class="btn btn-light" data-edit-product="${product.id}">
                                    Edit
                                </button>
                                <button class="btn btn-danger" data-delete-product="${product.id}">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        root.querySelectorAll("[data-edit-product]").forEach(button => {
            button.onclick = () => editProduct(button.dataset.editProduct);
        });

        root.querySelectorAll("[data-delete-product]").forEach(button => {
            button.onclick = () => deleteProduct(button.dataset.deleteProduct);
        });
    }

    function editProduct(id) {
        const product = DB.getProducts().find(
            item => item.id === String(id)
        );

        if (!product) return;

        productForm.reset();
        productError.textContent = "";
        productForm.classList.remove("hidden");

        $("#product-form-title").textContent = "Edit product";

        productForm.elements.id.value = product.id;
        productForm.elements.name.value = product.name;
        fillCategories(product.categoryId);
        productForm.elements.price.value = product.price;
        productForm.elements.stock.value = product.stock;
        productForm.elements.image.value = product.image;
        productForm.elements.description.value = product.description;

        productForm.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    async function deleteProduct(id) {
        if (!confirm("Delete this product?")) return;

        try {
            if (/^\d+$/.test(String(id))) {
                await ProductAPI.delete(id);
            }

            DB.saveProducts(
                DB.getProducts().filter(item => item.id !== String(id))
            );

            DB.saveCart(
                DB.getCart().filter(item => item.productId !== String(id))
            );

            DB.saveWishlist(
                DB.getWishlist().filter(item => item !== String(id))
            );

            renderProducts();
            renderCategories();
            toast("Product deleted from this browser.");
        } catch (error) {
            toast("Could not delete product through Fake API.");
            console.error(error);
        }
    }

    $("#new-product-btn").onclick = () => {
        productForm.reset();
        productForm.elements.id.value = "";
        fillCategories();

        $("#product-form-title").textContent = "Add product";
        productError.textContent = "";

        productForm.classList.remove("hidden");
        productForm.scrollIntoView({ behavior: "smooth" });
    };

    $("#cancel-product").onclick = () => {
        productForm.classList.add("hidden");
        productError.textContent = "";
    };

    productForm.addEventListener("submit", async event => {
        event.preventDefault();

        const data = Object.fromEntries(new FormData(productForm));
        productError.textContent = "";

        const price = Number(data.price);
        const stock = Number(data.stock);

        if ((data.name || "").trim().length < 2) {
            productError.textContent =
                "Product name must be at least 2 characters.";
            return;
        }

        if (!DB.getCategories().some(c => c.id === data.categoryId)) {
            productError.textContent = "Choose a valid category.";
            return;
        }

        if (!Number.isFinite(price) || price <= 0) {
            productError.textContent = "Price must be greater than zero.";
            return;
        }

        if (!Number.isInteger(stock) || stock < 0) {
            productError.textContent =
                "Stock must be a whole number, zero or greater.";
            return;
        }

        try {
            const url = new URL(data.image);

            if (!["http:", "https:"].includes(url.protocol)) {
                throw new Error();
            }
        } catch {
            productError.textContent =
                "Enter a valid image URL starting with http:// or https://.";
            return;
        }

        if ((data.description || "").trim().length < 10) {
            productError.textContent =
                "Description must be at least 10 characters.";
            return;
        }

        const products = DB.getProducts();

        const product = {
            id: data.id || DB.id("product"),
            name: data.name.trim(),
            categoryId: data.categoryId,
            price,
            stock,
            image: data.image.trim(),
            description: data.description.trim()
        };

        const index = products.findIndex(
            item => item.id === String(product.id)
        );

        try {
            if (index >= 0) {
                if (/^\d+$/.test(String(product.id))) {
                    await ProductAPI.update(product.id, product);
                }

                products[index] = product;
            } else {
                await ProductAPI.add(product);
                products.unshift(product);
            }

            DB.saveProducts(products);
            renderProducts();
            renderCategories();

            productForm.classList.add("hidden");

            toast(index >= 0
                ? "Product updated locally."
                : "Product added locally.");
        } catch (error) {
            productError.textContent =
                "Fake API request failed. Changes were not saved.";
            console.error(error);
        }
    });

    function renderCategories() {
        const root = $("#admin-category-list");

        root.innerHTML = `
            <table>
                <thead>
                    <tr><th>Category</th><th>Products</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${DB.getCategories().map(category => `
                        <tr>
                            <td>${escapeHTML(category.name)}</td>
                            <td>
                                ${DB.getProducts().filter(
                                    product => product.categoryId === category.id
                                ).length}
                            </td>
                            <td>
                                <button class="btn btn-light" data-edit-cat="${category.id}">
                                    Rename
                                </button>
                                <button class="btn btn-danger" data-delete-cat="${category.id}">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        root.querySelectorAll("[data-edit-cat]").forEach(button => {
            button.onclick = () => {
                const category = DB.getCategories().find(
                    item => item.id === button.dataset.editCat
                );

                if (!category) return;

                const input = prompt("New category name:", category.name);

                if (input === null) return;

                const name = input.trim();

                if (name.length < 2 || name.length > 40) {
                    toast("Category name must be 2–40 characters.");
                    return;
                }

                if (DB.getCategories().some(item =>
                    item.id !== category.id &&
                    item.name.toLowerCase() === name.toLowerCase()
                )) {
                    toast("That category already exists.");
                    return;
                }

                category.name = name;
                DB.saveCategories(DB.getCategories());

                renderCategories();
                fillCategories(category.id);
                toast("Category renamed locally.");
            };
        });

        root.querySelectorAll("[data-delete-cat]").forEach(button => {
            button.onclick = () => {
                const id = button.dataset.deleteCat;

                if (DB.getProducts().some(
                    product => product.categoryId === id
                )) {
                    toast("Delete or move the category's products first.");
                    return;
                }

                if (!confirm("Delete this category?")) return;

                DB.saveCategories(
                    DB.getCategories().filter(category => category.id !== id)
                );

                renderCategories();
                fillCategories();
                toast("Category deleted locally.");
            };
        });
    }

    $("#category-form").addEventListener("submit", event => {
        event.preventDefault();

        const name = new FormData(event.currentTarget)
            .get("name").trim();

        const error = $("#category-error");
        error.textContent = "";

        if (name.length < 2 || name.length > 40) {
            error.textContent = "Category name must be 2–40 characters.";
            return;
        }

        if (DB.getCategories().some(
            category => category.name.toLowerCase() === name.toLowerCase()
        )) {
            error.textContent = "This category already exists.";
            return;
        }

        DB.saveCategories([
            ...DB.getCategories(),
            {
                id: DB.id("category"),
                name,
                slug: name.toLowerCase().trim().replace(/\s+/g, "-"),
                source: "local"
            }
        ]);

        event.currentTarget.reset();
        renderCategories();
        fillCategories();

        toast("Category added locally.");
    });

    function renderOrders() {
        const root = $("#admin-order-list");
        const orders = DB.getOrders();

        if (!orders.length) {
            root.innerHTML = '<p class="empty">No orders yet.</p>';
            return;
        }

        root.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Order</th><th>Customer</th><th>Items</th>
                        <th>Total</th><th>Date</th><th>Status / Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td>${escapeHTML(order.id)}</td>
                            <td>
                                ${escapeHTML(order.customerName)}
                                <br>
                                <span class="muted">${escapeHTML(order.customerEmail)}</span>
                            </td>
                            <td>
                                ${order.items.map(item =>
                                    `${escapeHTML(item.name)} × ${item.quantity}`
                                ).join("<br>")}
                            </td>
                            <td>${money(order.total)}</td>
                            <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                            <td>
                                <span class="status ${order.status.toLowerCase()}">
                                    ${escapeHTML(order.status)}
                                </span>
                                <br>
                                ${order.status === "PENDING" ? `
                                    <button class="btn btn-light"
                                        data-order-action="CONFIRMED"
                                        data-order-id="${escapeHTML(order.id)}">
                                        Confirm
                                    </button>
                                    <button class="btn btn-danger"
                                        data-order-action="REJECTED"
                                        data-order-id="${escapeHTML(order.id)}">
                                        Reject
                                    </button>
                                ` : ""}
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        root.querySelectorAll("[data-order-action]").forEach(button => {
            button.onclick = () => updateOrder(
                button.dataset.orderId,
                button.dataset.orderAction
            );
        });
    }

    function updateOrder(id, status) {
        const orders = DB.getOrders();
        const order = orders.find(item => item.id === id);

        if (!order || order.status !== "PENDING") return;

        if (status === "CONFIRMED") {
            const products = DB.getProducts();

            for (const item of order.items) {
                const product = products.find(
                    entry => entry.id === String(item.productId)
                );

                if (!product || product.stock < item.quantity) {
                    toast(`Insufficient stock for ${item.name}.`);
                    return;
                }
            }

            for (const item of order.items) {
                const product = products.find(
                    entry => entry.id === String(item.productId)
                );

                product.stock -= item.quantity;
            }

            DB.saveProducts(products);
            renderProducts();
        }

        order.status = status;
        DB.saveOrders(orders);

        renderOrders();
        toast(`Order ${status.toLowerCase()}.`);
    }

    $("#admin-form").addEventListener("submit", event => {
        event.preventDefault();

        const data = Object.fromEntries(new FormData(event.currentTarget));
        const error = $("#admin-error");
        error.textContent = "";

        if (data.name.trim().length < 2) {
            error.textContent = "Enter a name with at least 2 characters.";
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            error.textContent = "Enter a valid email address.";
            return;
        }

        if (
            data.password.length < 8 ||
            !/[A-Za-z]/.test(data.password) ||
            !/[0-9]/.test(data.password)
        ) {
            error.textContent =
                "Password must be at least 8 characters and include a letter and a number.";
            return;
        }

        if (data.password !== data.confirmPassword) {
            error.textContent = "Passwords do not match.";
            return;
        }

        const users = DB.getUsers();

        if (users.some(
            user => user.email.toLowerCase() === data.email.trim().toLowerCase()
        )) {
            error.textContent = "This email is already registered.";
            return;
        }

        users.push({
            id: DB.id("admin"),
            name: data.name.trim(),
            email: data.email.trim().toLowerCase(),
            password: data.password,
            role: "ADMIN"
        });

        DB.saveUsers(users);
        event.currentTarget.reset();

        toast("Admin account created.");
    });

    fillCategories();
    renderProducts();
    renderCategories();
    renderOrders();
});

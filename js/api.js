
const ProductAPI = (() => {
    const BASE_URL = "https://dummyjson.com";
    const INITIALIZED_KEY = "cozycart_api_initialized";

    async function request(endpoint, options = {}) {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return response.json();
    }

    function categoryId(slug) {
        return `api_cat_${slug.replace(/[^a-z0-9]/gi, "_")}`;
    }

    async function initialize(force = false) {
        if (
            !force &&
            localStorage.getItem(INITIALIZED_KEY) === "true"
        ) {
            return;
        }

        const [productData, categoryData] = await Promise.all([
            request("/products?limit=0"),
            request("/products/category-list")
        ]);

        const categories = categoryData.map(slug => ({
            id: categoryId(slug),
            name: slug
                .split("-")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" "),
            slug
        }));

        const categoryMap = new Map(
            categories.map(category => [category.slug, category.id])
        );

        const products = productData.products.map(product => ({
            id: String(product.id),
            name: product.title,
            categoryId: categoryMap.get(product.category),
            price: product.price,
            stock: product.stock,
            image: product.thumbnail,
            description: product.description,
            source: "dummyjson"
        }));

        DB.saveCategories(categories);
        DB.saveProducts(products);

        localStorage.setItem(INITIALIZED_KEY, "true");
    }

    async function getAll() {
        const data = await request("/products?limit=0");
        return data.products;
    }

    async function search(query) {
        const data = await request(
            `/products/search?q=${encodeURIComponent(query)}`
        );

        return data.products;
    }

    async function add(product) {
        return request("/products/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: product.name,
                description: product.description,
                price: product.price,
                stock: product.stock,
                thumbnail: product.image
            })
        });
    }

    async function update(id, product) {
        return request(`/products/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: product.name,
                description: product.description,
                price: product.price,
                stock: product.stock,
                thumbnail: product.image
            })
        });
    }

    async function remove(id) {
        return request(`/products/${id}`, {
            method: "DELETE"
        });
    }

    return {
        initialize,
        getAll,
        search,
        add,
        update,
        delete: remove
    };
})();

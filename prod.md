# Product Management Documentation

## Product Structure

### Core Attributes
- `name` (required): Product name
- `description` (required): Product description
- `category` (required): One of: Phone, Laptop, Accessories, Tablet
- `stock` (required): Current quantity in stock
- `storeId` (required): ID of the store where the product is located
- `price` (required): Selling price
- `cost_price` (required): Purchase/cost price
- `lowStockThreshold` (optional): Threshold for low stock alerts (defaults to 5)
- `imei` (optional): Unique IMEI number for phones and tablets

## API Endpoints

### 1. List Products (GET /api/products)
Supports pagination and multiple search/filter parameters:

#### Query Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `sortBy`: Field to sort by (options: created_at, name, price, stock, category, store_name, cost_price)
- `sortOrder`: Sort direction ('asc' or 'desc')
- `storeId`: Filter by store ID
- `category`: Filter by product category
- `minStock`: Filter by minimum stock level
- `maxStock`: Filter by maximum stock level
- `search`: Search in name, description, and IMEI
- `lowStock`: Filter low stock items (true/false)
- `imei`: Search by IMEI number

#### Example Queries

1. Basic Search:
```http
GET /api/products?search=iphone
```

2. IMEI Search:
```http
GET /api/products?imei=123456789
```

3. Combined Search with Filters:
```http
GET /api/products?search=phone&category=Phone&storeId=1&page=1&limit=20&sortBy=price&sortOrder=desc
```

4. Low Stock Items:
```http
GET /api/products?lowStock=true
```

### 2. Create Product (POST /api/products)
Requires ADMIN or MANAGER role.

Example request body:
```json
{
  "name": "iPhone 13",
  "description": "Latest iPhone model",
  "category": "Phone",
  "stock": 10,
  "price": 999.99,
  "cost_price": 800.00,
  "storeId": 1,
  "lowStockThreshold": 3,
  "imei": "123456789012345"
}
```

### 3. Update Product (PATCH /api/products/:id)
Requires ADMIN or MANAGER role.

Example request body (partial update allowed):
```json
{
  "stock": 15,
  "price": 899.99,
  "imei": "987654321098765"
}
```

### 4. Delete Product (DELETE /api/products/:id)
Requires ADMIN or MANAGER role.

### 5. Get Product Categories (GET /api/products/categories)
Returns available product categories.

## Search Functionality

The product search is flexible and supports multiple ways to find products:

1. **General Search**
   - Searches across name, description, and IMEI
   - Case-insensitive
   - Partial matches supported
   ```http
   GET /api/products?search=iphone
   ```

2. **IMEI-Specific Search**
   - Search specifically by IMEI number
   - Partial matches supported
   ```http
   GET /api/products?imei=123456
   ```

3. **Combined Search**
   - Combine multiple parameters for precise results
   ```http
   GET /api/products?search=phone&category=Phone&lowStock=true
   ```

4. **Advanced Filtering**
   - Filter by store: `storeId=1`
   - Filter by category: `category=Phone`
   - Filter by stock levels: `minStock=5&maxStock=100`
   - Show low stock items: `lowStock=true`

## Best Practices

1. **IMEI Management**
   - IMEI numbers must be unique across all products
   - Recommended for Phone and Tablet categories
   - Maximum length: 15 characters

2. **Stock Management**
   - Set appropriate `lowStockThreshold` for automated alerts
   - Use `lowStock=true` parameter to monitor inventory
   - Regular stock updates recommended

3. **Search Optimization**
   - Use specific search parameters when possible
   - Combine search parameters for more precise results
   - Use pagination for large result sets 
# Node.js/TypeScript Backend Requirements

## 1. Overview

This document outlines the requirements for a Node.js/TypeScript backend to replace the current Supabase BaaS for the POS Admin Dashboard frontend. The backend will be responsible for data storage, business logic, API provision, and user authentication/authorization.

## 2. Data Models

The following data models are derived from the frontend's TypeScript interfaces (`src/lib/supabase.ts`) and `README.md`. Naming should be consistent (e.g., singular for models, plural for table names if following common conventions).

### 2.1. `Store`
Represents a retail store location.
- `id`: number (Primary Key)
- `name`: string
- `address`: string
- `phone`: string
- `manager`: string (Potentially a foreign key to `Personnel` or `User` ID)
- `created_at`: string (timestamp)
- `updated_at`: string (timestamp)

### 2.2. `Personnel` (also referred to as `User` or `Employee` in frontend/docs)
Represents an employee or user of the system. This entity will be central to authentication and authorization.
- `id`: number (Primary Key)
- `Name`: string (Consider splitting into `first_name`, `last_name`)
- `Role`: string (e.g., 'Store Manager', 'Sales Associate') - Used for authorization.
- `Phone`: string
- `Password`: string (Must be securely hashed and stored)
- `storeId`: number (Foreign Key to `Store.id`)
- `email`: string (The frontend indicates `email_display` is for UI only and `email` is not stored in the DB for `Personnel`, but the `User` interface has `email`. This needs clarification. For a proper auth system, a unique email is standard.)
- `created_at`: string (timestamp)

### 2.3. `Product`
Represents an item in the inventory.
- `id`: number (Primary Key)
- `name`: string
- `description`: string
- `category`: string
- `base_price`: number
- `stock`: number
- `storeId`: number (Foreign Key to `Store.id`)
- `created_at`: string (timestamp)
- `price`: number (alias or derived from `base_price`?)
- `cost_price`: number
- `stock_level`: number (alias for `stock`?)
- `low_stock_threshold`: number

### 2.4. `Order`
Represents a customer order.
- `id`: number (Primary Key)
- `customer_name`: string
- `customer_phone`: string (optional)
- `customer_email`: string (optional)
- `total_amount`: number
- `status`: string (e.g., 'Pending', 'Completed', 'Cancelled')
- `payment_method`: string
- `store_id`: number (Foreign Key to `Store.id`)
- `user_id`: number (Foreign Key to `Personnel.id` - the employee who processed the order)
- `created_at`: string (timestamp)
- `updated_at`: string (timestamp)

### 2.5. `OrderItem`
Represents an individual item within an `Order`.
- `id`: number (Primary Key)
- `order_id`: number (Foreign Key to `Order.id`)
- `product_id`: number (Foreign Key to `Product.id`)
- `quantity`: number
- `unit_price`: number (Price at the time of sale)
- `created_at`: string (timestamp)

### 2.6. `ActivityLog`
Records significant actions performed in the system.
- `id`: number (Primary Key)
- `user_id`: number (Foreign Key to `Personnel.id`)
- `action`: string (e.g., 'Added employee', 'Deleted product')
- `entity_type`: string (e.g., 'Personnel', 'Product')
- `entity_id`: number (ID of the affected entity)
- `store_id`: number (optional, Foreign Key to `Store.id` if action is store-specific)
- `details`: string (Descriptive text of the activity)
- `created_at`: string (timestamp)

### 2.7. `Sale`
(Interface exists, but usage not prominent in analyzed files. Might be for aggregated sales data.)
- `id`: number (Primary Key)
- `store_id`: number (Foreign Key to `Store.id`)
- `employee_id`: number (Foreign Key to `Personnel.id`)
- `total_amount`: number
- `profit`: number
- `payment_method`: string
- `created_at`: string (timestamp)

### 2.8. `Cart` & `Cart_Items`
(Interfaces exist, suggesting potential for a shopping cart feature, but usage not seen in core page components analyzed. May be for a customer-facing part or future feature.)
- **`Cart`**
    - `id`: number (Primary Key)
    - `created_at`: string (timestamp)
    - `updated_at`: string (timestamp)
    - `personal_id`: number (Unclear, could be `Personnel.id` or a customer ID if such an entity exists)
- **`Cart_Items`**
    - `id`: number (Primary Key)
    - `created_at`: string (timestamp)
    - `cart_id`: number (Foreign Key to `Cart.id`)
    - `product_id`: number (Foreign Key to `Product.id`)
    - `quantity`: number
    - `selling_price`: number
    - `total_price`: number

## 3. API Endpoints

The backend should expose RESTful API endpoints for the data models. Standard CRUD operations are expected:

- **Stores (`/api/stores`)**
    - `GET /`: List all stores
    - `POST /`: Create a new store
    - `GET /{id}`: Get a specific store
    - `PUT /{id}`: Update a specific store
    - `DELETE /{id}`: Delete a specific store

- **Personnel (`/api/personnel` or `/api/users`)**
    - `GET /`: List all personnel (with filtering options for role, store)
    - `POST /`: Create new personnel (handles password hashing)
    - `GET /{id}`: Get specific personnel
    - `PUT /{id}`: Update specific personnel (password updates should be handled carefully)
    - `DELETE /{id}`: Delete specific personnel

- **Products (`/api/products`)**
    - `GET /`: List all products (with filtering for store, category, stock levels)
    - `POST /`: Create a new product
    - `GET /{id}`: Get a specific product
    - `PUT /{id}`: Update a specific product
    - `DELETE /{id}`: Delete a specific product

- **Orders (`/api/orders`)**
    - `GET /`: List all orders (with filtering for store, status, customer)
    - `POST /`: Create a new order (should also create `OrderItems`)
    - `GET /{id}`: Get a specific order (including its items)
    - `PUT /{id}`: Update an order (e.g., change status)
    - `DELETE /{id}`: Delete an order (consider implications, soft delete might be better)

- **Activity Logs (`/api/activity-logs`)**
    - `GET /`: List activity logs (with filtering by user, entity_type, store, date range; support for joining with Personnel and Store names for display as seen in frontend)
    - `POST /`: Create an activity log (typically called internally by other API endpoints after operations like create/update/delete)

- **Sales, Carts, CartItems (if implemented)**
    - Similar CRUD endpoints if these features are to be built out.

**General API Considerations:**
- Support for pagination for all list endpoints.
- Consistent error response format.
- Input validation for all incoming data.
- Endpoints should return related data where appropriate (e.g., an order should include its items and customer/user details). Frontend uses joins like `Personel(Name)` and `Store(name)`.

### 3.1. Dashboard Specific Endpoints

Based on `src/pages/Dashboard.tsx`, the following aggregated data is required. These endpoints should perform calculations and aggregations on the backend to reduce client-side load and improve performance.

- **`GET /api/stats/summary`**
    - Provides overall key metrics for display in stats cards.
    - Response should include:
        - `totalSales`: number (overall)
        - `totalSalesByStore`: Array of objects, e.g., `[{ storeId: 1, storeName: 'Yaoundé', totalSales: 50000 }, ...]`
        - `totalProducts`: number
        - `totalEmployees`: number
        - `totalOrders`: number (based on Carts or Orders table)
    - Optional query parameters: `?period=last_30_days` (to scope some stats like sales).

- **`GET /api/stats/sales-over-time`**
    - Provides data for sales trend charts (e.g., BarChart).
    - Query Parameters:
        - `groupBy`: enum (`day`, `week`, `month`) - default `month`
        - `period`: string (e.g., `last_6_months`, `current_year`, or `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`) - default `last_6_months`
        - `storeIds`: string (comma-separated store IDs, e.g., `1,2` - optional, if not provided, aggregates for all stores or provides breakdown per store)
    - Response Structure: Array of objects, where each object represents a time period and contains sales figures for requested stores.
        - Example if `storeIds` is provided and aggregation is per period: `[{ period: 'Jan', totalSales: 12000 }, { period: 'Feb', totalSales: 15000 }]`
        - Example if `storeIds` are distinct and breakdown is needed: `[{ period: 'Jan', Yaoundé: 7000, Buea: 5000 }, { period: 'Feb', Yaoundé: 8000, Buea: 7000 }]` (frontend currently expects this format)

- **`GET /api/stats/product-category-distribution`**
    - Provides data for the product categories pie chart.
    - Response Structure: Array of objects, e.g., `[{ categoryName: 'Electronics', productCount: 120, percentage: 30.0 }, ...]`

- **`GET /api/activity-logs/recent` (Alternative to full `/api/activity-logs` with specific params)**
    - Provides a short list of recent activities for a dashboard feed (if desired).
    - Query Parameters: `limit`: number (e.g., 5) - default 5
    - Response: Same as `GET /api/activity-logs` but limited.

- **`GET /api/orders/recent` (Alternative to full `/api/orders` with specific params)**
    - Provides a short list of recent orders/sales for a dashboard feed (if desired).
    - Query Parameters: `limit`: number (e.g., 5) - default 5
    - Response: Same as `GET /api/orders` but limited and likely including key details like customer, total, and status.

## 4. Authentication and Authorization

- **Authentication:**
    - Since a `Password` field exists in the `Personnel` model, the backend must implement its own credential management.
    - Implement a token-based authentication system (e.g., JWT).
    - Endpoints:
        - `/api/auth/login`: Authenticate user (Personnel) with email/username and password, return JWT.
        - `/api/auth/register`: (If self-registration is allowed) Register new personnel.
        - `/api/auth/me`: Get current authenticated user's details.
- **Authorization:**
    - Role-based access control (RBAC) based on the `Personnel.Role` field.
    - Define permissions for each role (e.g., 'Store Manager' can manage personnel in their store, 'Sales Associate' can create orders).
    - Secure API endpoints to ensure only authorized users can perform certain actions.

## 5. Activity Logging

- A robust mechanism to log key activities is required.
- The `ActivityLog` model and its corresponding API endpoint are already defined.
- Service/controller methods that perform create, update, or delete operations on critical resources (Personnel, Products, Stores, Orders) should internally create an `ActivityLog` entry.
- The `user_id` for the log should be derived from the authenticated user making the request.

## 6. Assumptions and Points to Clarify

- **`Personnel` vs. `User` vs. `Employee` Entity:** The terminology and table names (`Personel`, `users`, `Personnel`) need to be consolidated. This document assumes `Personnel` is the primary entity for staff who log in and use the system. Clarify if a separate `User` table (as per the `User` interface) is for customers or another purpose.
- **Email for `Personnel`:** The `Personnel` interface indicates email is not stored, while the `User` interface includes it, and `AddEmployeeModal` has an email field noted as "for display only". For a backend authentication system, a unique email per user is standard practice and highly recommended for password resets, notifications, etc. This should be clarified and likely implemented.
- **Database Choice:** This document assumes a relational database (like PostgreSQL, MySQL) given the Supabase background and table structures.
- **Real-time Features:** Supabase offers real-time subscriptions. If the frontend relies on this for any features not immediately obvious from the analyzed code, these need to be identified and alternative solutions (e.g., WebSockets) planned for the new backend.
- **File Storage:** Supabase Storage is often used for images or other files. If the application uses this (e.g., for product images), the new backend will need a file storage solution (e.g., local storage, AWS S3, Cloudinary). This was not apparent in the analyzed files but is a common Supabase feature.
- **Password Hashing:** Ensure industry-standard password hashing algorithms (e.g., bcrypt, Argon2) are used.
- **Environment Variables:** The backend will require its own set of environment variables (e.g., `DATABASE_URL`, `JWT_SECRET`, `PORT`).
- **Data Migration:** A plan for migrating existing data from Supabase to the new backend database will be necessary.

This document provides a starting point. Further detailed analysis of each frontend component and its Supabase interactions might reveal more specific requirements. 
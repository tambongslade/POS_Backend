# Product Management Documentation

## Product Structure
Products in the system have the following key attributes:
- Name (required)
- Description (required)
- Category (required, one of: Phone, Laptop, Accessories, Tablet)
- Stock quantity (required)
- Store ID (required)
- Price (required, selling price)
- Cost Price (required)
- Low Stock Threshold (optional)
- IMEI (optional, unique)

## IMEI Handling
The IMEI (International Mobile Equipment Identity) is handled as follows:
- It's an optional field
- Maximum length: 15 characters
- Must be unique across all products
- Stored as a VARCHAR in the database
- Particularly relevant for Phone and Tablet categories

## How to Add a New Product

### 1. Authentication Requirements
- Only users with ADMIN or MANAGER roles can add products
- Must be authenticated with a valid JWT token

### 2. API Endpoint
```
POST /api/products
```

### 3. Request Body Format
```json
{
  "name": "Product Name",
  "description": "Product Description",
  "category": "Phone",  // Must be one of: "Phone", "Laptop", "Accessories", "Tablet"
  "stock": 10,
  "storeId": 1,
  "price": 999.99,
  "costPrice": 799.99,
  "lowStockThreshold": 5,  // Optional
  "imei": "123456789012345"  // Optional, max 15 characters
}
```

### 4. IMEI Best Practices
1. **When to Include IMEI:**
   - Always include for individual Phone units
   - Recommended for Tablets
   - Not necessary for Accessories or bulk items

2. **IMEI Validation:**
   - Must be unique across all products
   - Maximum 15 characters
   - Should be provided at the time of product creation for trackable items

3. **IMEI Format:**
   - Standard IMEI format: 15 digits
   - No special characters allowed
   - Case sensitive

### 5. Validation Rules
- Name: Required, max 255 characters
- Description: Required, text field
- Category: Must be one of the predefined ProductCategory enum values
- Stock: Integer, minimum 0
- Store ID: Integer, must be valid existing store
- Price: Decimal number with up to 2 decimal places, minimum 0
- Cost Price: Decimal number with up to 2 decimal places, minimum 0
- Low Stock Threshold: Optional integer, minimum 0
- IMEI: Optional string, max 15 characters, must be unique

### 6. Example API Calls

1. **Adding a Phone with IMEI:**
```json
{
  "name": "iPhone 13",
  "description": "Latest iPhone model",
  "category": "Phone",
  "stock": 1,
  "storeId": 1,
  "price": 999.99,
  "costPrice": 799.99,
  "lowStockThreshold": 5,
  "imei": "353915108120010"
}
```

2. **Adding an Accessory (without IMEI):**
```json
{
  "name": "Phone Case",
  "description": "Protective case",
  "category": "Accessories",
  "stock": 50,
  "storeId": 1,
  "price": 29.99,
  "costPrice": 15.99,
  "lowStockThreshold": 10
}
```

### 7. Error Handling
The API will return appropriate error messages for:
- Invalid IMEI format
- Duplicate IMEI
- Missing required fields
- Invalid category values
- Invalid numerical values
- Authentication/authorization failures 
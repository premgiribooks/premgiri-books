# 117 - Masters Service

> Feature-spec file number 117. Milestone v4, Phase 2, tracker **#108**.
> Depends On: spec 116 (Company Service).

## Goal

Extract all master data modules (customers, suppliers, products, categories, brands,
units, warehouses, HSN codes, GST rates, margin profiles, price lists, employees,
payment modes) into a standalone `masters-service`.

---

## Owns (in per-company DB)

Customers, Suppliers, Products, Categories, Brands, Units, Warehouses, HsnCodes,
GstRates, MarginProfiles, PriceLists, Employees, PaymentModes, ProductBatches, SerialNumbers

---

## Key Responsibilities

1. Full CRUD for all master entities with company-scoped access
2. Barcode resolution (`findByBarcode`) for billing (spec 97)
3. Product search (name/code/barcode), Customer search, Supplier search
4. Price resolution via Pricing Engine (gRPC call to engine-service)
5. Batch and serial number catalog management

---

## Redis Caching (when enabled)

| Cache Key | TTL | Invalidated On |
|---|---|---|
| `{cid}:masters:product:{id}` | 15 min | Product update |
| `{cid}:masters:product:list` | 5 min | Any product create/update |
| `{cid}:masters:customer:{id}` | 15 min | Customer update |
| `{cid}:masters:gstrate:list` | 6 hours | GST rate change |
| `{cid}:masters:barcode:{code}` | 15 min | Product barcode update |

---

## gRPC Interface

```protobuf
service MastersService {
  rpc GetProduct(GetProductRequest) returns (ProductResponse);
  rpc GetCustomer(GetCustomerRequest) returns (CustomerResponse);
  rpc GetSupplier(GetSupplierRequest) returns (SupplierResponse);
  rpc GetWarehouse(GetWarehouseRequest) returns (WarehouseResponse);
  rpc GetGstRate(GetGstRateRequest) returns (GstRateResponse);
  rpc FindProductByBarcode(BarcodeRequest) returns (ProductResponse);
  rpc ListSelectableCustomers(ListRequest) returns (CustomerListResponse);
  rpc ListSelectableProducts(ListRequest) returns (ProductListResponse);
}
```

---

## Testing Requirements

- All master CRUD operations are company-scoped (cross-company isolation test)
- Barcode lookup returns correct product; non-existent barcode returns NOT_FOUND
- Redis cache hit/miss paths both return identical results
- Product search returns results within 100ms on a 10,000-product dataset

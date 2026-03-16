# Menu ER Diagram

```mermaid
erDiagram
    Category {
        int id PK
        varchar name UK "unique"
        text description
        decimal base_price "nullable - for inheritance"
        varchar image
        int display_order
        boolean active
    }

    Product {
        int id PK
        int category_id FK
        varchar name UK "unique"
        text description
        decimal price "nullable - inherits from category"
        varchar image
        int display_order
        boolean customizable "for future orders module"
        boolean active
    }

    Category ||--o{ Product : "contains"
```

# Library Management System — REST API (Postman-ready)

Base URL: `http://localhost:3000`  
API prefix: `/api`  
Health: `GET /health`

## Authentication

After login, send header on protected routes:

```http
Authorization: Bearer <access_token>
```

JWT payload includes `sub` (user or admin id) and `role` (`admin` | `user`).

---

## 1. Auth (`/api/auth`)

### Admin login

`POST /api/auth/admin/login`  
**Body (JSON):**

```json
{
  "adminName": "<your-admin-name>",
  "password": "<your-admin-password>"
}
```

> Do not commit real credentials. After `npm run seed`, change the default admin password before production use.

**200 example:**

```json
{
  "success": true,
  "message": "Admin signed in",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "adminId": 1,
      "adminName": "<your-admin-name>",
      "created_at": "...",
      "updated_at": "..."
    }
  }
}
```

### User login

`POST /api/auth/user/login`  
**Body:**

```json
{
  "userName": "<approved-member-username>",
  "password": "<member-password>"
}
```

**200:** same shape with `data.token` and `data.user`.

**Login eligibility:** only users with `status: "APPROVED"` may sign in. Self-registered users start as `PENDING` until an admin approves them.

| Status | Result |
|--------|--------|
| `APPROVED` | **200** — JWT issued |
| `PENDING` | **401** — `success: false`, `message`: "Your account is not approved yet" |
| `REJECTED` | **401** — `success: false`, `message`: "Your account has been rejected" |

### User registration (public)

`POST /api/auth/register` — no authentication.

**Body (JSON):**

```json
{
  "user_name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass1!",
  "date_of_birth": "2000-01-01",
  "department_id": 1
}
```

Rules: valid email, password length ≥ 8, required fields as above.

**201 example:**

```json
{
  "success": true,
  "message": "Registration submitted. Wait for admin approval.",
  "data": {
    "usersId": 2,
    "userName": "John Doe",
    "email": "john@example.com",
    "status": "PENDING",
    "department": { ... }
  }
}
```

**409** if `user_name` or `email` is already taken (`message`: "Username or email is already registered").

---

## 1b. Admin — member approval (`/api/admin`)

These routes manage **library users** (`Users` table), not admin accounts. Admin account CRUD remains under `/api/admins`.

| Method | Path | Auth | Role |
|--------|------|------|------|
| PUT | `/api/admin/users/:id/approve` | Bearer | admin |
| PUT | `/api/admin/users/:id/reject` | Bearer | admin |

No body required. **200** returns updated user (with `department`) and `message`: "User approved" or "User rejected".

---

## 2. Categories (`/api/categories`)

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/categories` | Yes | admin, user |
| GET | `/api/categories/:id` | Yes | admin, user |
| POST | `/api/categories` | Yes | admin |
| PUT | `/api/categories/:id` | Yes | admin |
| DELETE | `/api/categories/:id` | Yes | admin |

**Create body:**

```json
{ "categoryName": "Fiction" }
```

---

## 3. Authors (`/api/authors`)

Same pattern as categories.

**Create body:**

```json
{
  "authorName": "Jane Austen",
  "country": "United Kingdom"
}
```

`country` is optional (max 100 characters).

---

## 4. Books (`/api/books`)

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/books` | Yes | admin, user |
| GET | `/api/books/:id` | Yes | admin, user |
| GET | `/api/books/:id/availability` | Yes | admin, user |
| POST | `/api/books` | Yes | admin |
| PUT | `/api/books/:id` | Yes | admin |
| DELETE | `/api/books/:id` | Yes | admin |

**Create body:**

```json
{
  "bookName": "Pride and Prejudice",
  "releaseDate": "1813-01-28",
  "description": "Classic novel",
  "place": "Shelf (2) Row (3)",
  "categoryId": 1,
  "authorId": 1
}
```

`place` is optional (recommended format: `Shelf (X) Row (Y)`, max 100 characters).

**Availability 200 example:**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "bookId": 1,
    "available": true,
    "activeRental": null
  }
}
```

If rented (`return_date` null on a row), `available` is `false` and `activeRental` includes the open rental.

---

## 5. eBooks (`/api/ebooks`)

**Create body:**

```json
{
  "eBookName": "Sample eBook",
  "releaseDate": "2020-01-01",
  "description": "Digital edition",
  "coverImage": "https://example.com/cover.jpg",
  "pdfFile": "https://example.com/file.pdf",
  "categoryId": 1,
  "authorId": 1
}
```

CRUD rules: same as books (read for any authenticated user; writes admin only).

### Track eBook read event

`POST /api/ebooks/:id/read`  
Auth: Bearer user token (`role=user`)

No body required. Creates a row in `ebook_reads` with:
- `user_id` from JWT user id
- `ebook_id` from URL param
- `read_at` current timestamp

**201 example:**

```json
{
  "success": true,
  "message": "eBook read tracked",
  "data": {
    "id": 10,
    "userId": 2,
    "ebookId": 4,
    "readAt": "2026-04-06T09:10:11.000Z"
  }
}
```

---

## 6. Departments (`/api/departments`)

**Create body:**

```json
{ "departmentName": "Computer Science" }
```

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/departments` | Yes | admin, user |
| GET | `/api/departments/:id` | Yes | admin, user |
| POST / PUT / DELETE | … | Yes | **admin** |

---

## 7. Users (`/api/users`)

All routes: **admin only**.

**Create body:**

```json
{
  "userName": "jdoe",
  "password": "<member-password>",
  "dateOfBirth": "1995-05-15",
  "email": "jdoe@example.com",
  "departmentId": 1
}
```

Admin-created users are stored with `status: APPROVED` so they can sign in without going through `/api/auth/register` and approval.

---

## 8. Admins (`/api/admins`)

All routes: **admin only**.

**Create body:**

```json
{
  "adminName": "librarian1",
  "password": "SecurePass1"
}
```

---

## 9. Rent (`/api/rent`)

| Method | Path | Auth | Role | Notes |
|--------|------|------|------|--------|
| POST | `/api/rent` | Yes | admin, user | Rent book (business rules) |
| PATCH | `/api/rent/:id/return` | Yes | admin, user | Return book (sets `return_date`) |
| GET | `/api/rent` | Yes | admin, user | Admin: all; User: own rentals |
| GET | `/api/rent/:id` | Yes | admin, user | User: own only |
| PUT | `/api/rent/:id` | Yes | admin | Adjust record |
| DELETE | `/api/rent/:id` | Yes | admin | Delete record |

### Rent book

`POST /api/rent`  
**Body:**

```json
{
  "bookId": 1,
  "dueDate": "2026-04-20",
  "rentDate": "2026-04-06"
}
```

- **User** role: `usersId` is taken from the token (do not rely on `usersId` in body).
- **Admin** role: pass `usersId` to rent on behalf of a user.

**409** if the book already has an active rental (`return_date` IS NULL).

### Return book

`PATCH /api/rent/5/return`  
No body required. Sets `return_date` to today.

---

## 10. Dashboard (`/api/dashboard`)

Admin analytics endpoint (real-time, computed from existing tables).

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/dashboard/summary` | Yes | admin |

### Summary response shape

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "stats": {
      "totalBooks": 120,
      "totalEbooks": 80,
      "totalUsers": 250,
      "activeRentals": 34,
      "importedPapers": 18
    },
    "charts": {
      "rentals": {
        "dailyRentCount": 6,
        "weeklyRentCount": 25,
        "monthlyRentCount": 92
      },
      "users": {
        "monthlyNewUsers": 18
      }
    },
    "topBooks": [
      { "bookId": 3, "bookName": "Clean Code", "rentCount": 12 }
    ],
    "activeUsers": [
      { "userId": 9, "userName": "john", "email": "john@example.com", "readCount": 27 }
    ]
  }
}
```

---

## Error responses

Validation **422:**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "type": "field", "msg": "...", "path": "bookId", "location": "body" }]
}
```

App errors **4xx/5xx:**

```json
{
  "success": false,
  "message": "This book is already rented (no return date on active rental)"
}
```

---

## Quick start (Postman)

1. Copy `.env.example` to `.env` and set MySQL + `JWT_SECRET`.
2. Create database: `CREATE DATABASE library;`
3. `npm install`
4. `npm run migrate`
5. `npm run seed` (optional — creates a demo admin; **change that password before production**)
6. `npm run dev` or `npm start`
7. `POST /api/auth/admin/login` → copy `data.token` → use as Bearer for admin calls.

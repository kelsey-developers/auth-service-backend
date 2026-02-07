# Auth Service Backend

Express.js API with MySQL.

## Run with Docker

```bash
docker compose up --build
```

## Database Backup & Restore

**Backup**
```bash
docker compose exec mysql mysqldump -u app_user -papp_password auth_db > backup.sql
```

**Restore**
```bash
docker compose exec -T mysql mysql -u app_user -papp_password auth_db < backup.sql
```

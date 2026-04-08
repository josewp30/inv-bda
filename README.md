# 📦 InvControl — PWA de Inventario Físico

Sistema móvil-first para toma de inventario físico con sincronización a Google Sheets. Funciona offline y se instala como app nativa en cualquier smartphone.

---

## 🚀 Características

| Feature | Detalle |
|---|---|
| **Roles** | Administrador (control total) y Operador (solo conteo) |
| **Búsqueda** | Autocomplete en tiempo real por código o nombre |
| **Offline** | LocalStorage + Service Worker para trabajo sin señal |
| **Sync** | Google Apps Script como backend sin servidor |
| **Importación** | CSV/Excel masivo para catálogo de productos |
| **Auditoría** | Panel filtrable con exportación CSV |
| **PWA** | Instalable en iOS y Android como app nativa |

---

## 📋 Requisitos Previos

- Navegador moderno con soporte PWA (Chrome, Safari, Edge, Firefox)
- Cuenta de Google (para Google Sheets + Apps Script)
- Para desarrollo: Node.js 18+ (opcional, para servidor local)

---

## ⚡ Inicio Rápido (Sin Build)

La app es un único archivo HTML sin dependencias externas. Puedes usarla directamente:

```bash
# 1. Clona el repositorio
git clone https://github.com/tu-usuario/invcontrol.git
cd invcontrol

# 2. Sirve localmente (cualquier método funciona)
npx serve .              # Con Node.js
python -m http.server 8080  # Con Python
php -S localhost:8080    # Con PHP

# 3. Abre en el navegador
# http://localhost:8080
```

**Credenciales Demo:**
- Admin: `admin` / `admin`
- Operador: `op1` / `op1`

---

## 🔧 Configuración de Google Sheets

### Paso 1 — Crear el Spreadsheet

1. Ve a [sheets.google.com](https://sheets.google.com) y crea un nuevo archivo
2. Nómbralo `InvControl - Base de Datos`

### Paso 2 — Crear el Apps Script

1. En el Spreadsheet: **Extensiones → Apps Script**
2. Elimina el código existente y pega el contenido de `Code.gs`
3. Guarda el proyecto (Ctrl+S) con el nombre `InvControl API`

### Paso 3 — Configurar la API Key

En `Code.gs`, línea 18, reemplaza:
```javascript
API_KEY: 'TU_CLAVE_API_AQUI',
```
Por una clave segura de tu elección, por ejemplo:
```javascript
API_KEY: 'inv2024-$ecure-Key-XYZ',
```

### Paso 4 — Desplegar como Web App

1. **Implementar → Nueva implementación**
2. Tipo: **Aplicación web**
3. Ejecutar como: **Yo (tu cuenta)**
4. Acceso: **Cualquier usuario** *(o "Cualquier usuario, incluso anónimo" si no usas Auth)*
5. Clic en **Implementar**
6. **Copia la URL** que aparece (la necesitarás en el Paso 5)

### Paso 5 — Inicializar las hojas

1. Regresa al Spreadsheet
2. Aparecerá el menú **📦 InvControl** en la barra superior
3. Clic en **🔧 Configurar hojas**
4. Se crearán automáticamente: `Registros`, `Productos`, `Almacenes`, `Resumen`

### Paso 6 — Conectar la PWA

1. En la app, ve a **Admin → Config**
2. Pega la URL del Apps Script
3. Ingresa la misma API Key configurada en `Code.gs`
4. Clic en **Guardar Configuración**

---

## 📁 Estructura del Repositorio

```
invcontrol/
├── index.html          ← Aplicación completa (PWA single-file)
├── manifest.json       ← Manifest de la PWA
├── sw.js               ← Service Worker (cache + offline)
├── Code.gs             ← Backend Google Apps Script
├── .env.example        ← Plantilla de variables de entorno
├── .gitignore          ← Excluye .env y node_modules
└── README.md           ← Esta documentación
```

---

## 👤 Roles y Permisos

### Administrador
- ✅ CRUD completo de Productos y Almacenes
- ✅ Importación masiva CSV/Excel
- ✅ Panel de auditoría (ver, filtrar, eliminar registros)
- ✅ Gestión de usuarios
- ✅ Configuración del sistema
- ✅ Exportación de datos a CSV

### Operador
- ✅ Registro de conteo (formulario completo)
- ✅ Búsqueda de productos con autocomplete
- ✅ Lote offline con sincronización manual
- ❌ Sin acceso a datos maestros ni auditoría

---

## 📊 Formato CSV para Importación

```csv
codigo,nombre,categoria,unidad_base
PRD-001,Cemento Portland 42.5,Construcción,Saco
PRD-002,Varilla de Acero 3/8",Hierro,Und
PRD-003,Tubería PVC 4"x6m,PVC,Und
```

---

## 📡 API Reference (Apps Script)

### GET Endpoints

| Parámetro | Descripción |
|---|---|
| `?action=ping` | Health check |
| `?action=products&apiKey=KEY` | Lista de productos |
| `?action=warehouses&apiKey=KEY` | Lista de almacenes |
| `?action=records&apiKey=KEY&date=2024-01-15` | Registros por fecha |

### POST Endpoints

```json
// Agregar registros
{
  "action": "addRecords",
  "apiKey": "tu-clave",
  "records": [
    {
      "id": "REC-1234567890",
      "productCode": "PRD-001",
      "productName": "Cemento Portland 42.5",
      "warehouseId": "W001",
      "warehouseName": "Almacén Principal",
      "qty": 50,
      "unit": "CAJA",
      "userId": "op1",
      "userName": "Operador 01",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "obs": ""
    }
  ]
}
```

---

## 📲 Instalación como App (PWA)

### Android (Chrome)
1. Abre la URL en Chrome
2. Toca el menú (⋮) → **"Instalar app"** o **"Agregar a pantalla de inicio"**

### iOS (Safari)
1. Abre la URL en Safari
2. Toca el botón compartir (□↑)
3. **"Agregar a la pantalla de inicio"**

---

## 🔒 Seguridad

- La API Key nunca se expone en el frontend público; se guarda en `localStorage` del dispositivo del administrador
- En producción, considera usar Google OAuth para autenticar el Apps Script
- El `.gitignore` excluye `.env` para proteger credenciales
- Usa HTTPS siempre (requerido para Service Workers y PWA)

---

## 🛠 Desarrollo

```bash
# Instalar servidor de desarrollo con live reload
npm install -g live-server

# Iniciar con live reload
live-server --port=3000 --open=index.html

# O con Vite (si migras a módulos ES)
npm create vite@latest invcontrol -- --template vanilla
```

---

## 📄 Licencia

MIT — Libre para uso comercial y personal.

---

*Desarrollado para trabajo de inventario físico en almacenes industriales.*

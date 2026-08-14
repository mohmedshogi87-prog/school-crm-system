# GMIS School CRM & Admissions System 🏫

A full-stack School CRM & Student Admissions Management System built with React, TypeScript, Tailwind CSS, and a lightweight PowerShell HTTP backend API.

---

## 🌟 Key Features

- 📊 **Real-Time Analytics Dashboard**:
  - Live auto-updating metrics (every 3s) for **Grade Distribution**, **Conversion Rates**, **Nationality Breakdown**, **Address Distribution**, **Admissions Funnel**, **Weekly Lead Flow**, and **Channel Distribution**.

- 📥 **Smart Excel Student Upload**:
  - Auto-mapping of Excel fields (`الاسم الأول` + `الاسم الأخير` ➔ Full Name, `الاسم الأوسط` + `الاسم الأخير` ➔ Parent Name).
  - Dynamic placement into CRM pipeline columns (**Registered** vs **Interested**).
  - Multi-language localized button (`📥 Import Students` / `📥 استيراد الطلاب`).

- 🗑️ **Permanent Student Record Deletion**:
  - Instant REST API synchronized deletion (`DELETE /api/leads/:id`) preventing deleted records from reappearing on page refresh.

- 🌐 **Multilingual Support**:
  - Full Arabic and English interface switching with RTL layout support.

---

## 🚀 How to Run Locally

### Prerequisites
- Windows OS (PowerShell 5.1+)
- Node.js (Optional for development)

### Quick Start (Server & Web App)
Run the built-in PowerShell full-stack server from the project directory:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\server_static.ps1
```

Access the application in your browser:
`http://localhost:3000`

---

## 📁 Repository Structure

```
├── dist/                 # Production web application bundle
├── src/                  # React + TypeScript source code
│   ├── components/       # UI Components & Layouts
│   ├── pages/            # CRM, Analytics, Dashboard pages
│   └── App.tsx           # Main application routing
├── server_static.ps1     # Full-stack PowerShell HTTP server & REST API
├── package.json          # Project dependencies
└── README.md             # Documentation
```

---

## 📄 License
MIT License.

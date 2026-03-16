# DataLab — Auto Chart Generator

Upload a dataset and instantly get interactive charts. Built for data science portfolios.

![Python](https://img.shields.io/badge/Python-3.10+-6366f1?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-6366f1?style=flat-square&logo=flask&logoColor=white)
![Plotly](https://img.shields.io/badge/Plotly-5.18-f472b6?style=flat-square&logo=plotly&logoColor=white)
![pandas](https://img.shields.io/badge/pandas-2.0+-6366f1?style=flat-square&logo=pandas&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-1.26+-f472b6?style=flat-square&logo=numpy&logoColor=white)

---

## Features

- **Drag & drop upload** — CSV and Excel files up to 50MB
- **Dataset overview** — row/column count, missing values, data preview
- **Correlation matrix** — heatmap with values for all numeric columns
- **Distributions** — histograms for up to 10 numeric columns
- **Trends** — time series lines (datetime column) or scatter + trendline (numeric columns)
- **Dark theme UI** — clean, portfolio-ready design

---

## Tech Stack

### Backend
| Technology | Version | Role |
|------------|---------|------|
| **Python** | 3.10+   | Runtime |
| **Flask**  | 3.0     | Web framework — routing, file uploads, JSON API |
| **pandas** | 2.0+    | DataFrame parsing, stats, datetime detection |
| **NumPy**  | 1.26+   | Numeric operations, trendline fitting (polyfit) |
| **Plotly** | 5.18+   | Chart generation — serialized to JSON for the frontend |
| **openpyxl**| 3.1+   | Excel file parsing (`.xlsx` / `.xls`) |
| **Werkzeug**| 3.0+   | Secure filename handling |

### Frontend
| Technology | Role |
|------------|------|
| **HTML5**  | Single-page layout |
| **CSS3**   | Dark theme, responsive grid, animations |
| **Vanilla JS** | Drag & drop, fetch API, tab switching |
| **Plotly.js** (CDN) | Interactive chart rendering in the browser |

### Why this stack?
- **Flask** is the most widely used Python web framework in data science — lightweight, no boilerplate.
- **pandas + NumPy** are the industry standard for data wrangling and analysis.
- **Plotly** produces the best interactive charts for data science with zero frontend complexity.
- **Vanilla JS** keeps the frontend dependency-free — no build step, no node_modules.

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/datalab.git
cd datalab
```

### 2. Create a virtual environment

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the app

```bash
python app.py
```

Open `http://localhost:5000` in your browser.

---

## Project Structure

```
DataLab/
├── app.py                  # Flask backend — upload, parsing, chart generation
├── requirements.txt
├── templates/
│   └── index.html          # Single-page UI
├── static/
│   ├── css/style.css       # Dark theme styles
│   └── js/main.js          # Drag & drop, fetch, Plotly rendering
└── uploads/                # Temporary file storage (auto-created)
```

---

## Supported File Types

| Format | Extension     |
|--------|---------------|
| CSV    | `.csv`        |
| Excel  | `.xlsx` `.xls`|

---

## Chart Details

### Correlation Matrix
Pearson correlation heatmap across all numeric columns. Color scale from red (−1) to blue (+1).

### Distributions
Histogram per numeric column (up to 10). Auto-bins with 30 buckets.

### Trends
- **With a datetime column** — line chart + rolling average overlay per numeric column
- **Without a datetime column** — scatter plot with linear trendline (first numeric column as X-axis)

---

## License

MIT

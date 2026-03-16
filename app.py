from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder
import json
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}
os.makedirs('uploads', exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def try_parse_datetimes(df):
    datetime_cols = []
    for col in df.select_dtypes(exclude=[np.number]).columns:
        try:
            parsed = pd.to_datetime(df[col], infer_datetime_format=True)
            df[col] = parsed
            datetime_cols.append(col)
        except Exception:
            pass
    return df, datetime_cols


def generate_charts(df):
    df, datetime_cols = try_parse_datetimes(df)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    charts = {}

    # --- Correlation Matrix ---
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr().round(2)
        fig = go.Figure(go.Heatmap(
            z=corr.values,
            x=corr.columns.tolist(),
            y=corr.columns.tolist(),
            colorscale='RdBu_r',
            zmid=0,
            text=corr.values,
            texttemplate='%{text}',
            textfont={"size": 11},
            hoverongaps=False,
        ))
        fig.update_layout(
            title=dict(text='Correlation Matrix', font=dict(size=18)),
            template='plotly_dark',
            height=520,
            margin=dict(l=20, r=20, t=60, b=20),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
        )
        charts['correlation'] = json.loads(json.dumps(fig, cls=PlotlyJSONEncoder))

    # --- Distributions ---
    dist_charts = []
    for col in numeric_cols[:10]:
        data = df[col].dropna()
        fig = go.Figure()
        fig.add_trace(go.Histogram(
            x=data,
            nbinsx=30,
            marker=dict(color='#6366f1', opacity=0.85, line=dict(color='#4f46e5', width=1)),
            name=col,
        ))
        # Overlay KDE-like curve using numpy
        hist_vals, bin_edges = np.histogram(data, bins=30)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
        fig.update_layout(
            title=dict(text=f'Distribution: {col}', font=dict(size=16)),
            xaxis_title=col,
            yaxis_title='Count',
            template='plotly_dark',
            height=320,
            margin=dict(l=20, r=20, t=50, b=40),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            showlegend=False,
        )
        dist_charts.append(json.loads(json.dumps(fig, cls=PlotlyJSONEncoder)))
    charts['distributions'] = dist_charts

    # --- Trends ---
    trend_charts = []
    if datetime_cols and numeric_cols:
        dt_col = datetime_cols[0]
        df_sorted = df.sort_values(dt_col)
        for col in numeric_cols[:5]:
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=df_sorted[dt_col],
                y=df_sorted[col],
                mode='lines+markers',
                line=dict(color='#a78bfa', width=2),
                marker=dict(size=4, color='#7c3aed'),
                name=col,
            ))
            # Rolling average
            roll = df_sorted[col].rolling(window=max(3, len(df_sorted) // 20)).mean()
            fig.add_trace(go.Scatter(
                x=df_sorted[dt_col],
                y=roll,
                mode='lines',
                line=dict(color='#f472b6', width=2, dash='dash'),
                name=f'{col} (trend)',
            ))
            fig.update_layout(
                title=dict(text=f'{col} Over Time', font=dict(size=16)),
                xaxis_title=dt_col,
                yaxis_title=col,
                template='plotly_dark',
                height=340,
                margin=dict(l=20, r=20, t=50, b=40),
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
            )
            trend_charts.append(json.loads(json.dumps(fig, cls=PlotlyJSONEncoder)))
    elif len(numeric_cols) >= 2:
        x_col = numeric_cols[0]
        for col in numeric_cols[1:5]:
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=df[x_col],
                y=df[col],
                mode='markers',
                marker=dict(color='#a78bfa', size=6, opacity=0.7),
                name=col,
            ))
            # Linear trend line
            mask = df[[x_col, col]].dropna()
            if len(mask) > 1:
                m, b = np.polyfit(mask[x_col], mask[col], 1)
                x_range = np.linspace(mask[x_col].min(), mask[x_col].max(), 100)
                fig.add_trace(go.Scatter(
                    x=x_range,
                    y=m * x_range + b,
                    mode='lines',
                    line=dict(color='#f472b6', width=2, dash='dash'),
                    name='trend',
                ))
            fig.update_layout(
                title=dict(text=f'{col} vs {x_col}', font=dict(size=16)),
                xaxis_title=x_col,
                yaxis_title=col,
                template='plotly_dark',
                height=340,
                margin=dict(l=20, r=20, t=50, b=40),
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
            )
            trend_charts.append(json.loads(json.dumps(fig, cls=PlotlyJSONEncoder)))
    charts['trends'] = trend_charts

    return charts


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Use CSV or Excel (.xlsx/.xls).'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        df = pd.read_csv(filepath) if filename.lower().endswith('.csv') else pd.read_excel(filepath)

        summary = {
            'rows': int(len(df)),
            'cols': int(len(df.columns)),
            'columns': df.columns.tolist(),
            'dtypes': {k: str(v) for k, v in df.dtypes.items()},
            'missing': {k: int(v) for k, v in df.isnull().sum().items()},
            'preview': df.head(8).fillna('').astype(str).to_dict(orient='records'),
        }

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            desc = df[numeric_cols].describe().round(3)
            summary['describe'] = desc.to_dict()

        charts = generate_charts(df)

        return jsonify({'success': True, 'summary': summary, 'charts': charts})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

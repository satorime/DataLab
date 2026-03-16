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
        z    = corr.values.tolist()          # plain Python lists
        text = corr.round(2).values.tolist()
        cols = corr.columns.tolist()
        fig = go.Figure(go.Heatmap(
            z=z,
            x=cols,
            y=cols,
            colorscale='RdBu_r',
            zmid=0,
            text=text,
            texttemplate='%{text}',
            textfont={"size": 11},
            hoverongaps=False,
        ))
        fig.update_layout(
            title=dict(text='Correlation Matrix', font=dict(size=18)),
            height=520,
            margin=dict(l=20, r=20, t=60, b=20),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
        )
        charts['correlation'] = json.loads(json.dumps(fig, cls=PlotlyJSONEncoder))

    # --- Distributions ---
    # Pre-compute bins in Python → use go.Bar so the data is fully baked into the JSON.
    # This avoids client-side histogram computation mismatches between plotly-python and plotly.js.
    dist_charts = []
    for col in numeric_cols[:10]:
        data = df[col].dropna().values.astype(float)
        counts, bin_edges = np.histogram(data, bins=30)
        bin_centers = ((bin_edges[:-1] + bin_edges[1:]) / 2).round(4)
        bin_width    = float(bin_edges[1] - bin_edges[0])

        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=bin_centers.tolist(),
            y=counts.tolist(),
            width=bin_width * 0.85,
            marker=dict(color='#6366f1', opacity=0.85, line=dict(color='#4f46e5', width=1)),
            name=col,
        ))
        fig.update_layout(
            title=dict(text=f'Distribution: {col}', font=dict(size=16)),
            xaxis_title=col,
            yaxis=dict(title='Count', rangemode='tozero'),
            height=320,
            margin=dict(l=20, r=20, t=50, b=40),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            showlegend=False,
            bargap=0,
        )
        dist_charts.append(json.loads(json.dumps(fig, cls=PlotlyJSONEncoder)))
    charts['distributions'] = dist_charts

    # --- Trends ---
    trend_charts = []
    if datetime_cols and numeric_cols:
        dt_col    = datetime_cols[0]
        df_sorted = df.sort_values(dt_col)
        # Convert datetime to ISO strings so JSON serialization is unambiguous
        x_dates = df_sorted[dt_col].dt.strftime('%Y-%m-%d').tolist()
        for col in numeric_cols[:5]:
            y_vals = df_sorted[col].tolist()
            roll   = df_sorted[col].rolling(window=max(3, len(df_sorted) // 20)).mean()
            y_roll = roll.fillna('null').tolist()

            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=x_dates,
                y=y_vals,
                mode='lines+markers',
                line=dict(color='#a78bfa', width=2),
                marker=dict(size=4, color='#7c3aed'),
                name=col,
            ))
            fig.add_trace(go.Scatter(
                x=x_dates,
                y=y_roll,
                mode='lines',
                line=dict(color='#f472b6', width=2, dash='dash'),
                name=f'{col} (trend)',
            ))
            fig.update_layout(
                title=dict(text=f'{col} Over Time', font=dict(size=16)),
                xaxis_title=dt_col,
                yaxis_title=col,
                template=None,
                height=340,
                margin=dict(l=20, r=20, t=50, b=40),
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
            )
            trend_charts.append(json.loads(json.dumps(fig, cls=PlotlyJSONEncoder)))
    elif len(numeric_cols) >= 2:
        x_col = numeric_cols[0]
        for col in numeric_cols[1:5]:
            mask  = df[[x_col, col]].dropna()
            x_raw = mask[x_col].tolist()
            y_raw = mask[col].tolist()

            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=x_raw,
                y=y_raw,
                mode='markers',
                marker=dict(color='#a78bfa', size=6, opacity=0.7),
                name=col,
            ))
            if len(mask) > 1:
                m, b    = np.polyfit(mask[x_col].values, mask[col].values, 1)
                x_range = np.linspace(mask[x_col].min(), mask[x_col].max(), 100)
                fig.add_trace(go.Scatter(
                    x=x_range.tolist(),
                    y=(m * x_range + b).tolist(),
                    mode='lines',
                    line=dict(color='#f472b6', width=2, dash='dash'),
                    name='trend',
                ))
            fig.update_layout(
                title=dict(text=f'{col} vs {x_col}', font=dict(size=16)),
                xaxis_title=x_col,
                yaxis_title=col,
                template=None,
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

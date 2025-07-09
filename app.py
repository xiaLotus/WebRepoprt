from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# JSON檔案路徑
CHARTS_FILE = 'charts.json'

def load_charts():
    """載入圖表配置，補上缺漏欄位"""
    if os.path.exists(CHARTS_FILE):
        with open(CHARTS_FILE, 'r', encoding='utf-8') as f:
            charts = json.load(f)
            for c in charts:
                if 'expanded' not in c:
                    c['expanded'] = False
            return charts
    return []

def save_charts(charts):
    """儲存圖表配置"""
    with open(CHARTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(charts, f, ensure_ascii=False, indent=2)

@app.route("/api/chart-data")
def chart_data():
    """取得所有可用的圖表資料"""
    df = pd.read_csv("data.csv")
    grouped = df.groupby(["棟別", "樓層", "站點", "儲格"])
    result = []
    for (棟別, 樓層, 站點, 儲格), group in grouped:
        result.append({
            "title": f"{棟別}-{樓層} {儲格}",
            "棟別": 棟別,
            "樓層": 樓層,
            "站點": 站點,
            "儲格": 儲格,
            "xAxis": group["時間"].tolist(),
            "series": [{
                "name": 儲格,
                "type": "bar",
                "data": group["數值"].round(2).tolist()
            }]
        })
    return jsonify(result)

@app.route("/api/options")
def get_options():
    """取得棟別、樓層、站點的選項"""
    df = pd.read_csv("data.csv")
    
    # 取得所有唯一值
    buildings = sorted(df["棟別"].unique().tolist())
    floors = sorted(df["樓層"].unique().tolist())
    stations = sorted(df["站點"].unique().tolist())
    
    return jsonify({
        "buildings": buildings,
        "floors": floors,
        "stations": stations
    })

@app.route("/api/filtered-data")
def get_filtered_data():
    """根據選擇的棟別、樓層、站點取得對應的儲格資料"""
    building = request.args.get('building')
    floor = request.args.get('floor')
    station = request.args.get('station')
    
    df = pd.read_csv("data.csv")
    
    # 篩選資料
    filtered_df = df
    if building:
        filtered_df = filtered_df[filtered_df["棟別"] == building]
    if floor:
        filtered_df = filtered_df[filtered_df["樓層"] == floor]
    if station:
        filtered_df = filtered_df[filtered_df["站點"] == station]
    
    # 取得儲格選項
    storage_options = sorted(filtered_df["儲格"].unique().tolist())
    
    return jsonify({
        "storages": storage_options
    })

@app.route("/api/charts", methods=['GET'])
def get_charts():
    """取得已儲存的圖表配置"""
    charts = load_charts()
    return jsonify(charts)

@app.route("/api/charts", methods=['POST'])
def add_chart():
    """新增圖表"""
    data = request.json
    charts = load_charts()
    
    # 產生新的ID
    new_id = max([chart.get('id', 0) for chart in charts], default=0) + 1
    
    # 從CSV取得對應的圖表資料
    df = pd.read_csv("data.csv")
    filtered_df = df[
        (df["棟別"] == data["棟別"]) & 
        (df["樓層"] == data["樓層"]) & 
        (df["站點"] == data["站點"]) & 
        (df["儲格"] == data["儲格"])
    ]
    
    if filtered_df.empty:
        return jsonify({"error": "找不到對應的資料"}), 400
    
    new_chart = {
        "id": new_id,
        "title": f"{data['棟別']}-{data['樓層']} {data['儲格']}",
        "棟別": data["棟別"],
        "樓層": data["樓層"],
        "站點": data["站點"],
        "儲格": data["儲格"],
        "expanded": False,
        "xAxis": filtered_df["時間"].tolist(),
        "series": [{
            "name": data["儲格"],
            "type": "bar",
            "data": filtered_df["數值"].round(2).tolist()
        }],
        "created_at": datetime.now().isoformat()
    }
    
    charts.append(new_chart)
    save_charts(charts)
    
    return jsonify(new_chart), 201

@app.route("/api/charts/<int:chart_id>", methods=['PATCH'])
def update_chart(chart_id):
    """更新圖表設定"""
    data = request.json
    charts = load_charts()
    
    # 找到要更新的圖表
    chart_index = None
    for i, chart in enumerate(charts):
        if chart.get('id') == chart_id:
            chart_index = i
            break
    
    if chart_index is None:
        return jsonify({"error": "圖表不存在"}), 404
    
    # 更新圖表
    charts[chart_index].update({
        "title": data.get("title", charts[chart_index]["title"]),
        "expanded": data.get("expanded", charts[chart_index]["expanded"]),
        "updated_at": datetime.now().isoformat()
    })
    
    save_charts(charts)
    
    return jsonify(charts[chart_index])

@app.route("/api/charts-order", methods=['POST'])
def update_chart_order():
    new_order = request.json
    charts = load_charts()
    chart_dict = {chart["id"]: chart for chart in charts}

    reordered = []
    for item in new_order:
        chart = chart_dict.get(item["id"])
        if chart:
            chart["expanded"] = item.get("expanded", False)
            reordered.append(chart)

    save_charts(reordered)
    return jsonify({"message": "順序已更新"})

@app.route("/api/charts/<int:chart_id>", methods=['DELETE'])
def delete_chart(chart_id):
    """刪除圖表"""
    charts = load_charts()
    
    # 找到要刪除的圖表
    chart_index = None
    for i, chart in enumerate(charts):
        if chart.get('id') == chart_id:
            chart_index = i
            break
    
    if chart_index is None:
        return jsonify({"error": "圖表不存在"}), 404
    
    # 刪除圖表
    deleted_chart = charts.pop(chart_index)
    save_charts(charts)
    
    return jsonify({"message": "圖表已刪除", "deleted_chart": deleted_chart})

@app.route("/api/charts", methods=['DELETE'])
def clear_all_charts():
    """清除所有圖表"""
    save_charts([])
    return jsonify({"message": "所有圖表已清除"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

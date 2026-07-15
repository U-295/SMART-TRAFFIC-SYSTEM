from flask import Flask, render_template, request, jsonify
from datetime import datetime
import database

app = Flask(__name__)

@app.route('/')
def index():
    """Renders the main frontend dashboard."""
    return render_template('index.html')

@app.route('/api/update_density', methods=['POST'])
def update_density():
    """
    Receives manual vehicle count for a lane, calculates density and green time,
    and logs it in the database.
    """
    data = request.json
    lane_id = data.get('lane_id')
    vehicle_count = int(data.get('vehicle_count', 0))

    # Calculate density and signal timing
    # Logic: 
    #   < 20 vehicles = Low Density (10s green)
    #   20 - 50 vehicles = Medium Density (20s green)
    #   > 50 vehicles = High Density (30s green)
    if vehicle_count < 20:
        density = 'Low'
        green_time = 10
    elif vehicle_count <= 50:
        density = 'Medium'
        green_time = 20
    else:
        density = 'High'
        green_time = 30

    # Save to database
    database.add_traffic_log(lane_id, vehicle_count, density, green_time)

    return jsonify({
        'status': 'success',
        'lane_id': lane_id,
        'density': density,
        'green_time': green_time,
        'vehicle_count': vehicle_count
    })

@app.route('/api/emergency', methods=['POST'])
def trigger_emergency():
    """
    Logs an emergency event for a specific lane.
    """
    data = request.json
    lane_id = data.get('lane_id')

    database.add_emergency_log(lane_id)

    return jsonify({'status': 'success', 'message': f'Emergency triggered for lane {lane_id}'})

@app.route('/api/status', methods=['GET'])
def get_status():
    """
    Fetches analytics data: total vehicles today, peak hour, and hourly breakdown.
    """
    analytics = database.get_analytics_today()

    return jsonify(analytics)

@app.route('/api/emergency_history', methods=['GET'])
def get_emergency_history():
    """
    Fetches the recent emergency logs with lane names.
    """
    logs = database.get_emergency_history_logs()
    return jsonify(logs)

if __name__ == '__main__':
    database.init_db()
    app.run(debug=True)

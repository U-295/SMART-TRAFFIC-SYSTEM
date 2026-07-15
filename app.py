from flask import Flask, render_template, request, jsonify, Response
from datetime import datetime
import csv
import io
import database
import config

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

    # Load dynamic config settings
    t_low = int(database.get_setting('threshold_low', config.THRESHOLD_LOW))
    t_med = int(database.get_setting('threshold_medium', config.THRESHOLD_MEDIUM))
    gt_low = int(database.get_setting('green_time_low', config.GREEN_TIME_LOW))
    gt_med = int(database.get_setting('green_time_medium', config.GREEN_TIME_MEDIUM))
    gt_high = int(database.get_setting('green_time_high', config.GREEN_TIME_HIGH))

    # Calculate density and signal timing
    if vehicle_count < t_low:
        density = 'Low'
        base_green_time = gt_low
    elif vehicle_count <= t_med:
        density = 'Medium'
        base_green_time = gt_med
    else:
        density = 'High'
        base_green_time = gt_high

    # Apply weather adjustment multiplier
    weather = database.get_setting('weather', 'Clear')
    multiplier = config.WEATHER_MULTIPLIERS.get(weather, 1.0)
    green_time = int(base_green_time * multiplier)

    # Save to database
    database.add_traffic_log(lane_id, vehicle_count, density, green_time)

    return jsonify({
        'status': 'success',
        'lane_id': lane_id,
        'density': density,
        'green_time': green_time,
        'vehicle_count': vehicle_count,
        'weather': weather
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

@app.route('/api/weather', methods=['GET', 'POST'])
def handle_weather():
    """
    GET: Returns current system weather.
    POST: Updates system weather and adjusts timing.
    """
    if request.method == 'POST':
        data = request.json
        weather = data.get('weather', 'Clear')
        if weather in config.WEATHER_MULTIPLIERS:
            database.set_setting('weather', weather)
            return jsonify({'status': 'success', 'weather': weather})
        return jsonify({'status': 'error', 'message': 'Invalid weather condition'}), 400
    
    weather = database.get_setting('weather', 'Clear')
    return jsonify({'weather': weather})

@app.route('/api/pedestrian_crossing', methods=['POST'])
def trigger_pedestrian_crossing():
    """
    Logs a pedestrian crossing request for a lane to prioritize walk cycles.
    Expects json payload containing lane_id.
    """
    data = request.json
    lane_id = data.get('lane_id')
    database.add_pedestrian_request(lane_id)
    return jsonify({'status': 'success', 'message': f'Pedestrian crossing requested for lane {lane_id}'})

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """
    Fetches traffic logs with filters for lane and density level.
    """
    lane_id = request.args.get('lane_id', type=int)
    density = request.args.get('density')
    limit = request.args.get('limit', default=50, type=int)
    
    logs = database.get_filtered_logs(lane_id=lane_id, density=density, limit=limit)
    return jsonify(logs)

@app.route('/api/logs/export', methods=['GET'])
def export_logs():
    """
    Exports traffic logs to CSV format.
    """
    lane_id = request.args.get('lane_id', type=int)
    density = request.args.get('density')
    
    logs = database.get_filtered_logs(lane_id=lane_id, density=density, limit=1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Log ID', 'Lane Name', 'Vehicle Count', 'Density Level', 'Green Time (s)', 'Recorded At'])
    
    for log in logs:
        writer.writerow([
            log['id'],
            log['lane_name'],
            log['vehicle_count'],
            log['density_level'],
            log['green_time'],
            log['recorded_at']
        ])
    
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=traffic_logs_export.csv"}
    )

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    """
    GET: Returns current threshold & green time configuration.
    POST: Saves new configuration settings to database.
    """
    if request.method == 'POST':
        data = request.json
        database.set_setting('threshold_low', int(data.get('threshold_low', config.THRESHOLD_LOW)))
        database.set_setting('threshold_medium', int(data.get('threshold_medium', config.THRESHOLD_MEDIUM)))
        database.set_setting('green_time_low', int(data.get('green_time_low', config.GREEN_TIME_LOW)))
        database.set_setting('green_time_medium', int(data.get('green_time_medium', config.GREEN_TIME_MEDIUM)))
        database.set_setting('green_time_high', int(data.get('green_time_high', config.GREEN_TIME_HIGH)))
        return jsonify({'status': 'success', 'message': 'Configuration updated successfully'})
    
    return jsonify({
        'threshold_low': int(database.get_setting('threshold_low', config.THRESHOLD_LOW)),
        'threshold_medium': int(database.get_setting('threshold_medium', config.THRESHOLD_MEDIUM)),
        'green_time_low': int(database.get_setting('green_time_low', config.GREEN_TIME_LOW)),
        'green_time_medium': int(database.get_setting('green_time_medium', config.GREEN_TIME_MEDIUM)),
        'green_time_high': int(database.get_setting('green_time_high', config.GREEN_TIME_HIGH))
    })

if __name__ == '__main__':
    database.init_db()
    app.run(debug=True)
